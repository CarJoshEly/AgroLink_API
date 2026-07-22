import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CartStatus,
  InventoryMovementType,
  NotificationType,
  OrderStatus,
  Prisma,
  ProductStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { TransactionsService } from '../finance';
import { ListOrdersQueryDto, RejectOrderDto } from './dto';

export type Actor = { userId: string; role: UserRole };

const ORDER_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } } } },
  seller: { select: { id: true, businessName: true } },
  buyer: { select: { id: true, name: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  // --------------------------------------------------------------------
  // CHECKOUT (SOLICITUD DE COMPRA)
  // --------------------------------------------------------------------

  async checkout(buyerId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId: buyerId, status: CartStatus.ACTIVE },
      include: { items: { include: { product: { include: { seller: true } } } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Tu carrito está vacío');
    }

    for (const item of cart.items) {
      const product = item.product;
      if (product.deletedAt || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(`El producto "${product.name}" ya no está disponible`);
      }
      if (product.seller.verificationStatus !== VerificationStatus.VERIFIED) {
        throw new BadRequestException(`El producto "${product.name}" no está disponible actualmente`);
      }
      if (item.quantity > product.stock) {
        throw new BadRequestException(
          `No hay suficiente stock de "${product.name}" (disponible: ${product.stock})`,
        );
      }
    }

    const bySeller = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const list = bySeller.get(item.product.sellerId) ?? [];
      list.push(item);
      bySeller.set(item.product.sellerId, list);
    }

    const orders = await this.prisma.$transaction(async (tx) => {
      const created: Prisma.OrderGetPayload<{ include: { seller: true } }>[] = [];
      for (const [sellerId, items] of bySeller) {
        const orderItemsData = items.map((item) => {
          const unitPrice = Number(item.product.price);
          const subtotal = Number((unitPrice * item.quantity).toFixed(2));
          return { productId: item.productId, quantity: item.quantity, unitPrice, subtotal };
        });
        const totalAmount = Number(
          orderItemsData.reduce((sum, oi) => sum + oi.subtotal, 0).toFixed(2),
        );

        const order = await tx.order.create({
          data: {
            buyerId,
            sellerId,
            status: OrderStatus.PENDING,
            totalAmount,
            items: { create: orderItemsData },
          },
          include: { seller: true },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: null, toStatus: OrderStatus.PENDING, changedBy: buyerId },
        });
        created.push(order);
      }

      await tx.cart.update({ where: { id: cart.id }, data: { status: CartStatus.CONVERTED } });

      return created;
    });

    for (const order of orders) {
      await this.notificationsService.create(
        order.seller.userId,
        NotificationType.NEW_ORDER,
        'Nueva solicitud de compra',
        `Has recibido una nueva solicitud de compra por L${order.totalAmount}.`,
      );
    }

    return orders;
  }

  // --------------------------------------------------------------------
  // CONSULTA
  // --------------------------------------------------------------------

  async findMine(buyerId: string, query: ListOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {
      buyerId,
      ...(query.status ? { status: query.status } : {}),
      ...this.buildDateFilter(query),
    };
    return this.paginate(where, query);
  }

  async findReceived(sellerUserId: string, query: ListOrdersQueryDto) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!sellerProfile) throw new ForbiddenException('No tienes un perfil de vendedor');

    const where: Prisma.OrderWhereInput = {
      sellerId: sellerProfile.id,
      ...(query.status ? { status: query.status } : {}),
      ...this.buildDateFilter(query),
    };
    return this.paginate(where, query);
  }

  /** Listado sin restricción de propiedad, solo para administradores. */
  async findAll(query: ListOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.buyerId ? { buyerId: query.buyerId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...this.buildDateFilter(query),
    };
    return this.paginate(where, query);
  }

  async findById(id: string, actor: Actor) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        seller: { select: { id: true, businessName: true, userId: true } },
        buyer: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const isBuyer = order.buyerId === actor.userId;
    const isSeller = order.seller.userId === actor.userId;
    if (actor.role !== UserRole.ADMIN && !isBuyer && !isSeller) {
      throw new ForbiddenException('No tienes permiso para ver este pedido');
    }
    return order;
  }

  // --------------------------------------------------------------------
  // ACEPTAR / RECHAZAR
  // --------------------------------------------------------------------

  async accept(id: string, actor: Actor) {
    const order = await this.getOwnedOrder(id, actor);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Solo se pueden aceptar pedidos pendientes');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: order.items.map((item) => item.productId) } },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      const movements: Prisma.InventoryMovementCreateManyInput[] = [];
      for (const item of order.items) {
        const product = productById.get(item.productId);
        if (!product || item.quantity > product.stock) {
          throw new BadRequestException(
            `No hay suficiente stock de "${product?.name ?? item.productId}" para aceptar este pedido`,
          );
        }

        const previousStock = product.stock;
        const newStock = previousStock - item.quantity;
        const status =
          newStock === 0 && product.status === ProductStatus.ACTIVE
            ? ProductStatus.OUT_OF_STOCK
            : product.status;

        await tx.product.update({ where: { id: product.id }, data: { stock: newStock, status } });
        movements.push({
          productId: product.id,
          type: InventoryMovementType.EXIT,
          quantity: item.quantity,
          previousStock,
          newStock,
          reason: `Pedido ${order.id} aceptado`,
          createdBy: actor.userId,
        });
      }
      await tx.inventoryMovement.createMany({ data: movements });

      const result = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CONFIRMED,
          changedBy: actor.userId,
        },
      });
      return result;
    });

    await this.notificationsService.create(
      order.buyerId,
      NotificationType.ORDER_ACCEPTED,
      'Pedido aceptado',
      'El vendedor aceptó tu solicitud de compra.',
    );

    return updated;
  }

  async reject(id: string, actor: Actor, dto: RejectOrderDto) {
    const order = await this.getOwnedOrder(id, actor);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Solo se pueden rechazar pedidos pendientes');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CANCELLED,
          changedBy: actor.userId,
          note: dto.reason,
        },
      });
      return result;
    });

    await this.notificationsService.create(
      order.buyerId,
      NotificationType.ORDER_CANCELLED,
      'Pedido cancelado',
      dto.reason
        ? `Tu solicitud de compra fue rechazada: ${dto.reason}`
        : 'Tu solicitud de compra fue rechazada por el vendedor.',
    );

    return updated;
  }

  // --------------------------------------------------------------------
  // PREPARAR / ENTREGAR / CANCELAR
  // --------------------------------------------------------------------

  async prepare(id: string, actor: Actor) {
    const order = await this.getOwnedOrder(id, actor);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Solo se pueden preparar pedidos confirmados');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({ where: { id }, data: { status: OrderStatus.PREPARING } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: OrderStatus.CONFIRMED,
          toStatus: OrderStatus.PREPARING,
          changedBy: actor.userId,
        },
      });
      return result;
    });

    await this.notificationsService.create(
      order.buyerId,
      NotificationType.ORDER_PREPARING,
      'Pedido en preparación',
      'El vendedor está preparando tu pedido.',
    );

    return updated;
  }

  async deliver(id: string, actor: Actor) {
    const order = await this.getOwnedOrder(id, actor);
    if (order.status !== OrderStatus.PREPARING) {
      throw new BadRequestException('Solo se pueden entregar pedidos en preparación');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.DELIVERED, deliveredAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: OrderStatus.PREPARING,
          toStatus: OrderStatus.DELIVERED,
          changedBy: actor.userId,
        },
      });
      return result;
    });

    await this.notificationsService.create(
      order.buyerId,
      NotificationType.ORDER_DELIVERED,
      'Pedido entregado',
      'Tu pedido ha sido entregado.',
    );

    await this.transactionsService.recordForDeliveredOrder(order);

    return updated;
  }

  async cancel(id: string, actor: Actor, dto: RejectOrderDto) {
    const order = await this.getOwnedOrder(id, actor);
    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PREPARING) {
      throw new BadRequestException(
        'Solo se pueden cancelar pedidos confirmados o en preparación (usa "rechazar" para pedidos pendientes)',
      );
    }
    const previousStatus = order.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: order.items.map((item) => item.productId) } },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      const movements: Prisma.InventoryMovementCreateManyInput[] = [];
      for (const item of order.items) {
        const product = productById.get(item.productId);
        if (!product) continue;

        const previousStock = product.stock;
        const newStock = previousStock + item.quantity;
        const status =
          previousStock === 0 && product.status === ProductStatus.OUT_OF_STOCK
            ? ProductStatus.ACTIVE
            : product.status;

        await tx.product.update({ where: { id: product.id }, data: { stock: newStock, status } });
        movements.push({
          productId: product.id,
          type: InventoryMovementType.ENTRY,
          quantity: item.quantity,
          previousStock,
          newStock,
          reason: `Pedido ${order.id} cancelado`,
          createdBy: actor.userId,
        });
      }
      await tx.inventoryMovement.createMany({ data: movements });

      const result = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: previousStatus,
          toStatus: OrderStatus.CANCELLED,
          changedBy: actor.userId,
          note: dto.reason,
        },
      });
      return result;
    });

    await this.notificationsService.create(
      order.buyerId,
      NotificationType.ORDER_CANCELLED,
      'Pedido cancelado',
      dto.reason
        ? `Tu pedido fue cancelado: ${dto.reason}`
        : 'Tu pedido fue cancelado por el vendedor.',
    );

    return updated;
  }

  // --------------------------------------------------------------------
  // HISTORIAL Y DASHBOARD
  // --------------------------------------------------------------------

  async getHistory(id: string, actor: Actor) {
    await this.findById(id, actor); // reutiliza la verificación de propiedad (comprador/vendedor/admin)
    return this.prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
  }

  async getDashboard(sellerUserId: string) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!sellerProfile) throw new ForbiddenException('No tienes un perfil de vendedor');

    const [statusCounts, revenueAgg, recentOrders] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { sellerId: sellerProfile.id },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { sellerId: sellerProfile.id, status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.findMany({
        where: { sellerId: sellerProfile.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: ORDER_INCLUDE,
      }),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(OrderStatus).map((s) => [s, 0]),
    ) as Record<OrderStatus, number>;
    statusCounts.forEach((sc) => {
      byStatus[sc.status] = sc._count._all;
    });
    const totalOrders = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return {
      totalOrders,
      byStatus,
      pendingCount: byStatus.PENDING,
      totalRevenue: Number(revenueAgg._sum.totalAmount ?? 0),
      recentOrders,
    };
  }

  // --------------------------------------------------------------------
  // HELPERS PRIVADOS
  // --------------------------------------------------------------------

  private async paginate(where: Prisma.OrderWhereInput, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: query.skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ORDER_INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  private async getOwnedOrder(id: string, actor: Actor) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, seller: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (actor.role !== UserRole.ADMIN && order.seller.userId !== actor.userId) {
      throw new ForbiddenException('No tienes permiso para gestionar este pedido');
    }
    return order;
  }

  private buildDateFilter(query: ListOrdersQueryDto): Prisma.OrderWhereInput {
    if (!query.dateFrom && !query.dateTo) return {};
    return {
      createdAt: {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      },
    };
  }
}
