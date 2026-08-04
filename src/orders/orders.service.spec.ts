import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CartStatus,
  NotificationTargetType,
  OrderStatus,
  ProductStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { TransactionsService } from '../finance';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaMock;
  let notificationsService: { create: jest.Mock };
  let transactionsService: { recordForDeliveredOrder: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    notificationsService = { create: jest.fn() };
    transactionsService = { recordForDeliveredOrder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: TransactionsService, useValue: transactionsService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('checkout', () => {
    it('rechaza el checkout si el carrito está vacío', async () => {
      prisma.cart.findFirst.mockResolvedValue({ id: 'cart-1', items: [] } as any);
      await expect(service.checkout('buyer-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza el checkout si un producto no tiene suficiente stock', async () => {
      prisma.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: [
          {
            productId: 'p1',
            quantity: 10,
            product: {
              id: 'p1',
              name: 'Maíz',
              stock: 2,
              status: ProductStatus.ACTIVE,
              deletedAt: null,
              sellerId: 's1',
              price: 100,
              seller: { verificationStatus: VerificationStatus.VERIFIED },
            },
          },
        ],
      } as any);

      await expect(service.checkout('buyer-1')).rejects.toThrow(BadRequestException);
    });

    it('permite el checkout aunque el vendedor del producto no esté verificado (modelo estilo eBay)', async () => {
      prisma.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: [
          {
            productId: 'p1',
            quantity: 1,
            product: {
              id: 'p1',
              name: 'Maíz',
              stock: 10,
              status: ProductStatus.ACTIVE,
              deletedAt: null,
              sellerId: 's1',
              price: 100,
              seller: { verificationStatus: VerificationStatus.PENDING },
            },
          },
        ],
      } as any);
      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        sellerId: 's1',
        totalAmount: 100,
        seller: { userId: 'user-s1' },
      } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.cart.update.mockResolvedValue({} as any);

      await expect(service.checkout('buyer-1')).resolves.toBeDefined();
    });

    it('rechaza el checkout si el vendedor está SUSPENDED', async () => {
      prisma.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: [
          {
            productId: 'p1',
            quantity: 1,
            product: {
              id: 'p1',
              name: 'Maíz',
              stock: 10,
              status: ProductStatus.ACTIVE,
              deletedAt: null,
              sellerId: 's1',
              price: 100,
              seller: { verificationStatus: VerificationStatus.SUSPENDED },
            },
          },
        ],
      } as any);

      await expect(service.checkout('buyer-1')).rejects.toThrow(BadRequestException);
    });

    it('divide un carrito multi-vendedor en un pedido por cada vendedor', async () => {
      const item = (id: string, sellerId: string) => ({
        productId: id,
        quantity: 1,
        product: {
          id,
          name: `Producto ${id}`,
          stock: 10,
          status: ProductStatus.ACTIVE,
          deletedAt: null,
          sellerId,
          price: 50,
          seller: { verificationStatus: VerificationStatus.VERIFIED },
        },
      });

      prisma.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: [item('p1', 'seller-a'), item('p2', 'seller-b')],
      } as any);

      let createCount = 0;
      prisma.order.create.mockImplementation((async (args: any) => {
        createCount += 1;
        return { id: `order-${createCount}`, sellerId: args.data.sellerId, totalAmount: 50, seller: { userId: `user-${args.data.sellerId}` } };
      }) as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.cart.update.mockResolvedValue({} as any);

      const orders = await service.checkout('buyer-1');

      expect(orders).toHaveLength(2);
      expect(prisma.order.create).toHaveBeenCalledTimes(2);
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
    });

    it('descuenta el stock y transiciona a OUT_OF_STOCK cuando llega a 0', async () => {
      prisma.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        items: [
          {
            productId: 'p1',
            quantity: 3,
            product: {
              id: 'p1',
              name: 'Maíz',
              stock: 3,
              status: ProductStatus.ACTIVE,
              deletedAt: null,
              sellerId: 's1',
              price: 100,
              seller: { verificationStatus: VerificationStatus.VERIFIED },
            },
          },
        ],
      } as any);
      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        sellerId: 's1',
        totalAmount: 300,
        seller: { userId: 'seller-user-1' },
      } as any);
      prisma.product.update.mockResolvedValue({} as any);
      prisma.inventoryMovement.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);
      prisma.cart.update.mockResolvedValue({} as any);

      await service.checkout('buyer-1');

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 0, status: ProductStatus.OUT_OF_STOCK } }),
      );
      expect(prisma.inventoryMovement.createMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('accept', () => {
    const actor = { userId: 'seller-user-1', role: UserRole.SELLER };
    const order = {
      id: 'order-1',
      status: OrderStatus.PENDING,
      buyerId: 'buyer-1',
      items: [{ productId: 'p1', quantity: 3 }],
      seller: { userId: actor.userId },
    };

    it('rechaza aceptar un pedido que ya no está pendiente', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.CONFIRMED } as any);
      await expect(service.accept('order-1', actor)).rejects.toThrow(BadRequestException);
    });

    // El stock se reserva en checkout() (ver ese describe), no aquí — accept()
    // ya no toca inventario, solo transiciona el estado del pedido.
    it('transiciona a CONFIRMED sin tocar stock y notifica al comprador', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: OrderStatus.CONFIRMED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      await service.accept('order-1', actor);

      expect(prisma.product.findMany).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CONFIRMED }) }),
      );
      expect(notificationsService.create).toHaveBeenCalled();
    });
  });

  describe('deliver', () => {
    it('registra la transacción financiera al entregar el pedido', async () => {
      const actor = { userId: 'seller-user-1', role: UserRole.SELLER };
      const order = {
        id: 'order-1',
        status: OrderStatus.PREPARING,
        buyerId: 'buyer-1',
        totalAmount: 100,
        items: [],
        seller: { userId: actor.userId },
      };
      prisma.order.findUnique.mockResolvedValue(order as any);
      prisma.order.update.mockResolvedValue({ ...order, status: OrderStatus.DELIVERED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      await service.deliver('order-1', actor);

      expect(transactionsService.recordForDeliveredOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-1' }),
      );
    });
  });

  describe('cancelMine', () => {
    const order = {
      id: 'order-1',
      buyerId: 'buyer-1',
      status: OrderStatus.PENDING,
      items: [{ productId: 'p1', quantity: 2 }],
      seller: { userId: 'seller-user-1' },
    };

    it('rechaza a un comprador que no es dueño del pedido', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      await expect(service.cancelMine('order-1', 'otro-comprador', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza cancelar un pedido que ya no está pendiente', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.CONFIRMED } as any);
      await expect(service.cancelMine('order-1', 'buyer-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza NotFoundException si el pedido no existe', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.cancelMine('no-existe', 'buyer-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cancela un pedido pendiente propio, restaura el stock reservado y notifica al vendedor', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Maíz', stock: 0, status: ProductStatus.OUT_OF_STOCK },
      ] as any);
      prisma.product.update.mockResolvedValue({} as any);
      prisma.inventoryMovement.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.order.update.mockResolvedValue({ ...order, status: OrderStatus.CANCELLED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      await service.cancelMine('order-1', 'buyer-1', { reason: 'Cambié de opinión' });

      // Reservado en checkout (3 - 2 = ... este pedido reservó 2, stock quedó
      // en 0) -> cancelar debe devolverlo a 2 y reactivar el producto.
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 2, status: ProductStatus.ACTIVE } }),
      );
      expect(prisma.inventoryMovement.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CANCELLED }) }),
      );
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ changedBy: 'buyer-1', note: 'Cambié de opinión' }),
        }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        'seller-user-1',
        expect.anything(),
        expect.any(String),
        expect.any(String),
        { targetType: NotificationTargetType.ORDER, targetId: 'order-1' },
      );
    });
  });

  describe('findById — control de propiedad', () => {
    const order = {
      id: 'order-1',
      buyerId: 'buyer-1',
      items: [],
      seller: { id: 's1', businessName: 'Finca X', userId: 'seller-user-1' },
      buyer: { id: 'buyer-1', name: 'Comprador' },
    };

    it('permite ver el pedido al comprador dueño', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      await expect(
        service.findById('order-1', { userId: 'buyer-1', role: UserRole.CUSTOMER }),
      ).resolves.toBeDefined();
    });

    it('permite ver el pedido al vendedor dueño', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      await expect(
        service.findById('order-1', { userId: 'seller-user-1', role: UserRole.SELLER }),
      ).resolves.toBeDefined();
    });

    it('permite ver el pedido a un admin', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      await expect(
        service.findById('order-1', { userId: 'otro', role: UserRole.ADMIN }),
      ).resolves.toBeDefined();
    });

    it('rechaza a un usuario ajeno al pedido', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      await expect(
        service.findById('order-1', { userId: 'extraño', role: UserRole.CUSTOMER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si el pedido no existe', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.findById('no-existe', { userId: 'x', role: UserRole.ADMIN }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
