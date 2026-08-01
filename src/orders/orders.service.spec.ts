import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CartStatus, OrderStatus, ProductStatus, UserRole, VerificationStatus } from '@prisma/client';
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

    it('rechaza el checkout si el vendedor del producto no está verificado', async () => {
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

    it('rechaza aceptar si el stock es insuficiente', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Maíz', stock: 1, status: ProductStatus.ACTIVE },
      ] as any);

      await expect(service.accept('order-1', actor)).rejects.toThrow(BadRequestException);
    });

    it('descuenta el stock, transiciona a OUT_OF_STOCK cuando llega a 0 y consulta los productos en un solo findMany', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Maíz', stock: 3, status: ProductStatus.ACTIVE },
      ] as any);
      prisma.product.update.mockResolvedValue({} as any);
      prisma.inventoryMovement.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.order.update.mockResolvedValue({ id: 'order-1', status: OrderStatus.CONFIRMED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      await service.accept('order-1', actor);

      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 0, status: ProductStatus.OUT_OF_STOCK } }),
      );
      expect(prisma.inventoryMovement.createMany).toHaveBeenCalledTimes(1);
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

    it('cancela un pedido pendiente propio y notifica al vendedor', async () => {
      prisma.order.findUnique.mockResolvedValue(order as any);
      prisma.order.update.mockResolvedValue({ ...order, status: OrderStatus.CANCELLED } as any);
      prisma.orderStatusHistory.create.mockResolvedValue({} as any);

      await service.cancelMine('order-1', 'buyer-1', { reason: 'Cambié de opinión' });

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
