import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationTargetType, NotificationType, ReportTargetType, UserRole } from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { AuditLogService } from '../audit';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaMock;
  let notificationsService: { createMany: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    notificationsService = { createMany: jest.fn().mockResolvedValue({ count: 1 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rechaza si el producto reportado no existe', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create('reporter-1', {
          targetType: ReportTargetType.PRODUCT,
          targetId: 'no-existe',
          reason: 'Motivo de prueba',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    // Cubre el bug real: antes de este fix, `createMany` se llamaba SIN un
    // 5to argumento — la notificación quedaba sin `targetType`/`targetId`
    // y el clic en el panel de admin no llevaba a ningún lado.
    it('notifica a los admins activos con el reporte como destino navegable', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as any);
      prisma.report.create.mockResolvedValue({ id: 'report-1' } as any);
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ] as any);

      await service.create('reporter-1', {
        targetType: ReportTargetType.PRODUCT,
        targetId: 'prod-1',
        reason: 'El producto no coincide con la descripción',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: UserRole.ADMIN, isActive: true } }),
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        ['admin-1', 'admin-2'],
        NotificationType.REPORT_RECEIVED,
        expect.any(String),
        expect.any(String),
        { targetType: NotificationTargetType.REPORT, targetId: 'report-1' },
      );
    });
  });
});
