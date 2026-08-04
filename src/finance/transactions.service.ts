import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, PaymentProvider, Prisma, TransactionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { AuditLogService } from '../audit';
import { CommissionConfigService } from './commission-config.service';
import { ListTransactionsQueryDto, UpdateTransactionStatusDto } from './dto';

export type FinanceActor = { userId: string; role: UserRole };

const TRANSACTION_INCLUDE = {
  order: {
    select: {
      id: true,
      totalAmount: true,
      buyerId: true,
      seller: { select: { id: true, businessName: true, userId: true } },
    },
  },
  paymentMethod: { select: { id: true, name: true, provider: true } },
} as const;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly commissionConfigService: CommissionConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Se invoca al entregar un pedido que NO pasó por `recordCompletedPaypalPayment`
   * (si ya tiene transacción de PayPal, el guard de abajo lo salta). Antes
   * buscaba el método de pago "PayPal" para pedidos que, por definición, no
   * se pagaron por PayPal — quedaban mal etiquetados en los reportes. Ahora
   * usa "Otro". También nacía en PENDING, lo que dejaba "ganancia neta" en
   * L.0 hasta que un admin la confirmara pedido por pedido a mano — nace
   * COMPLETED directamente, entrega = venta liquidada.
   *
   * No bloqueante: cualquier fallo se registra y se ignora.
   */
  async recordForDeliveredOrder(order: { id: string; totalAmount: Prisma.Decimal | number }): Promise<void> {
    try {
      const existing = await this.prisma.transaction.findUnique({ where: { orderId: order.id } });
      if (existing) return;

      const commissionConfig = await this.commissionConfigService.getCurrent().catch(() => null);
      if (!commissionConfig) {
        this.logger.warn(`No hay configuración de comisión activa; se omite transacción para pedido ${order.id}`);
        return;
      }

      const paymentMethod = await this.findPaymentMethod(PaymentProvider.OTHER);
      if (!paymentMethod) {
        this.logger.warn(`No hay un método de pago activo; se omite transacción para pedido ${order.id}`);
        return;
      }

      const amount = Number(order.totalAmount);
      const percentage = Number(commissionConfig.percentage);
      const commissionAmount = Number(((amount * percentage) / 100).toFixed(2));
      const now = new Date();

      await this.prisma.transaction.create({
        data: {
          orderId: order.id,
          paymentMethodId: paymentMethod.id,
          amount,
          commissionPercentage: percentage,
          commissionAmount,
          status: TransactionStatus.COMPLETED,
          completedAt: now,
        },
      });
    } catch (error) {
      this.logger.error(`Error registrando transacción para pedido ${order.id}`, error as Error);
    }
  }

  /**
   * Se invoca justo después de que PayPal confirma la captura del pago
   * (ver payments/paypal-payments.service.ts) — a diferencia de
   * `recordForDeliveredOrder`, acá el dinero ya se cobró de verdad, así que
   * la transacción nace COMPLETED en vez de PENDING. `externalReference`
   * guarda el id de captura de PayPal para poder conciliar el pago después.
   * No bloqueante por la misma razón que la de arriba: un fallo acá no debe
   * deshacer un pedido que ya fue creado y ya fue cobrado.
   */
  async recordCompletedPaypalPayment(
    order: { id: string; totalAmount: Prisma.Decimal | number },
    externalReference: string,
  ): Promise<void> {
    try {
      const existing = await this.prisma.transaction.findUnique({ where: { orderId: order.id } });
      if (existing) return;

      const commissionConfig = await this.commissionConfigService.getCurrent().catch(() => null);
      const paymentMethod = await this.findPaymentMethod(PaymentProvider.PAYPAL);
      if (!paymentMethod) {
        this.logger.warn(`No hay un método de pago PayPal activo; se omite transacción para pedido ${order.id}`);
        return;
      }

      const amount = Number(order.totalAmount);
      const percentage = commissionConfig ? Number(commissionConfig.percentage) : 0;
      const commissionAmount = Number(((amount * percentage) / 100).toFixed(2));
      const now = new Date();

      await this.prisma.transaction.create({
        data: {
          orderId: order.id,
          paymentMethodId: paymentMethod.id,
          amount,
          commissionPercentage: percentage,
          commissionAmount,
          status: TransactionStatus.COMPLETED,
          externalReference,
          completedAt: now,
        },
      });
    } catch (error) {
      this.logger.error(`Error registrando pago de PayPal para pedido ${order.id}`, error as Error);
    }
  }

  private async findPaymentMethod(provider: PaymentProvider) {
    return (
      (await this.prisma.paymentMethod.findFirst({ where: { isActive: true, provider } })) ??
      (await this.prisma.paymentMethod.findFirst({ where: { isActive: true } }))
    );
  }

  async findAll(query: ListTransactionsQueryDto) {
    const where = this.buildWhere(query);
    return this.paginate(where, query);
  }

  async findMine(sellerUserId: string, query: ListTransactionsQueryDto) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!sellerProfile) throw new ForbiddenException('No tienes un perfil de vendedor');

    const where: Prisma.TransactionWhereInput = {
      ...this.buildWhere(query),
      order: { sellerId: sellerProfile.id },
    };
    return this.paginate(where, query);
  }

  async findById(id: string, actor: FinanceActor) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: TRANSACTION_INCLUDE,
    });
    if (!transaction) throw new NotFoundException('Transacción no encontrada');

    const isBuyer = transaction.order.buyerId === actor.userId;
    const isSeller = transaction.order.seller.userId === actor.userId;
    if (actor.role !== UserRole.ADMIN && !isBuyer && !isSeller) {
      throw new ForbiddenException('No tienes permiso para ver esta transacción');
    }
    return transaction;
  }

  async updateStatus(id: string, dto: UpdateTransactionStatusDto, adminId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: TRANSACTION_INCLUDE,
    });
    if (!transaction) throw new NotFoundException('Transacción no encontrada');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.externalReference !== undefined ? { externalReference: dto.externalReference } : {}),
        ...(dto.status === TransactionStatus.COMPLETED ? { completedAt: new Date() } : {}),
      },
    });

    await this.auditLogService.log(
      adminId,
      'TRANSACTION_STATUS_UPDATED',
      'Transaction',
      id,
      { status: transaction.status },
      { status: updated.status },
    );

    await this.notificationsService.create(
      transaction.order.seller.userId,
      NotificationType.PAYMENT_UPDATE,
      'Actualización de pago',
      `El pago de tu pedido #${transaction.order.id} cambió a estado ${dto.status}.`,
    );

    return updated;
  }

  async getAdminDashboard() {
    const [byStatus, completedAgg, currentConfig, recentTransactions] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { amount: true, commissionAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED },
        _sum: { amount: true, commissionAmount: true },
      }),
      this.commissionConfigService.getCurrent().catch(() => null),
      this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: TRANSACTION_INCLUDE,
      }),
    ]);

    return {
      totalVolume: Number(completedAgg._sum.amount ?? 0),
      totalCommissionCollected: Number(completedAgg._sum.commissionAmount ?? 0),
      currentCommissionPercentage: currentConfig ? Number(currentConfig.percentage) : null,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        amount: Number(s._sum.amount ?? 0),
        commissionAmount: Number(s._sum.commissionAmount ?? 0),
      })),
      recentTransactions,
    };
  }

  async getSellerDashboard(sellerUserId: string) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!sellerProfile) throw new ForbiddenException('No tienes un perfil de vendedor');

    const where: Prisma.TransactionWhereInput = { order: { sellerId: sellerProfile.id } };

    const [byStatus, completedAgg, recentTransactions] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true, commissionAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, status: TransactionStatus.COMPLETED },
        _sum: { amount: true, commissionAmount: true },
      }),
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: TRANSACTION_INCLUDE,
      }),
    ]);

    const totalAmount = Number(completedAgg._sum.amount ?? 0);
    const totalCommission = Number(completedAgg._sum.commissionAmount ?? 0);

    return {
      totalEarnings: Number((totalAmount - totalCommission).toFixed(2)),
      totalVolume: totalAmount,
      totalCommissionPaid: totalCommission,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        amount: Number(s._sum.amount ?? 0),
        commissionAmount: Number(s._sum.commissionAmount ?? 0),
      })),
      recentTransactions,
    };
  }

  private buildWhere(query: ListTransactionsQueryDto): Prisma.TransactionWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
  }

  private async paginate(where: Prisma.TransactionWhereInput, query: ListTransactionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip: query.skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: TRANSACTION_INCLUDE,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
