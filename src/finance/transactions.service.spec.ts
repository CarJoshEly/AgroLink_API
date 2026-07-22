import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProvider, TransactionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { AuditLogService } from '../audit';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { CommissionConfigService } from './commission-config.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaMock;
  let notificationsService: { create: jest.Mock };
  let auditLogService: { log: jest.Mock };
  let commissionConfigService: { getCurrent: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    notificationsService = { create: jest.fn() };
    auditLogService = { log: jest.fn() };
    commissionConfigService = { getCurrent: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: CommissionConfigService, useValue: commissionConfigService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('recordForDeliveredOrder', () => {
    const order = { id: 'order-1', totalAmount: 1000 };

    it('crea la transacción PENDING con la comisión calculada del porcentaje activo', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      commissionConfigService.getCurrent.mockResolvedValue({ percentage: 10 });
      prisma.paymentMethod.findFirst
        .mockResolvedValueOnce({ id: 'pm-paypal', provider: PaymentProvider.PAYPAL } as any);
      prisma.transaction.create.mockResolvedValue({} as any);

      await service.recordForDeliveredOrder(order);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          paymentMethodId: 'pm-paypal',
          amount: 1000,
          commissionPercentage: 10,
          commissionAmount: 100,
          status: TransactionStatus.PENDING,
        },
      });
    });

    it('no crea nada si ya existe una transacción para el pedido (idempotente)', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ id: 'existing' } as any);

      await service.recordForDeliveredOrder(order);

      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('omite la creación silenciosamente si no hay comisión activa', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      commissionConfigService.getCurrent.mockRejectedValue(new Error('no active config'));

      await expect(service.recordForDeliveredOrder(order)).resolves.toBeUndefined();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('omite la creación silenciosamente si no hay método de pago activo', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      commissionConfigService.getCurrent.mockResolvedValue({ percentage: 10 });
      prisma.paymentMethod.findFirst.mockResolvedValue(null);

      await expect(service.recordForDeliveredOrder(order)).resolves.toBeUndefined();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('actualiza el estado, registra auditoría y notifica al vendedor', async () => {
      const transaction = {
        id: 'txn-1',
        status: TransactionStatus.PENDING,
        order: { id: 'order-1', seller: { userId: 'seller-user-1' } },
      };
      prisma.transaction.findUnique.mockResolvedValue(transaction as any);
      prisma.transaction.update.mockResolvedValue({ ...transaction, status: TransactionStatus.COMPLETED } as any);

      await service.updateStatus('txn-1', { status: TransactionStatus.COMPLETED } as any, 'admin-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        'admin-1',
        'TRANSACTION_STATUS_UPDATED',
        'Transaction',
        'txn-1',
        { status: TransactionStatus.PENDING },
        { status: TransactionStatus.COMPLETED },
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        'seller-user-1',
        expect.any(String),
        expect.any(String),
        expect.stringContaining('order-1'),
      );
    });
  });

  describe('getAdminDashboard', () => {
    it('agrega volumen, comisión y desglose por estado', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { status: TransactionStatus.COMPLETED, _count: { _all: 2 }, _sum: { amount: 300, commissionAmount: 30 } },
      ] as any);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 300, commissionAmount: 30 } } as any);
      commissionConfigService.getCurrent.mockResolvedValue({ percentage: 10 });
      prisma.transaction.findMany.mockResolvedValue([] as any);

      const dashboard = await service.getAdminDashboard();

      expect(dashboard.totalVolume).toBe(300);
      expect(dashboard.totalCommissionCollected).toBe(30);
      expect(dashboard.currentCommissionPercentage).toBe(10);
      expect(dashboard.byStatus).toHaveLength(1);
    });
  });

  describe('getSellerDashboard', () => {
    it('rechaza si el usuario no tiene perfil de vendedor', async () => {
      prisma.sellerProfile.findUnique.mockResolvedValue(null);
      await expect(service.getSellerDashboard('no-seller')).rejects.toThrow();
    });

    it('calcula ganancias netas = volumen completado - comisión', async () => {
      prisma.sellerProfile.findUnique.mockResolvedValue({ id: 'sp-1' } as any);
      prisma.transaction.groupBy.mockResolvedValue([] as any);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 500, commissionAmount: 50 } } as any);
      prisma.transaction.findMany.mockResolvedValue([] as any);

      const dashboard = await service.getSellerDashboard('seller-user-1');

      expect(dashboard.totalEarnings).toBe(450);
    });
  });
});
