import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database';
import { AuditLogService } from '../audit';
import { createPrismaMock, PrismaMock } from '../test/prisma-mock';
import { CommissionConfigService } from './commission-config.service';

describe('CommissionConfigService', () => {
  let service: CommissionConfigService;
  let prisma: PrismaMock;
  let auditLogService: { log: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    // $transaction recibe un callback que espera un "tx" — como el mock de
    // Prisma ya simula todos los modelos, simplemente le pasamos el mismo
    // objeto como si fuera la transacción.
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    auditLogService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get(CommissionConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getCurrent', () => {
    it('retorna la configuración activa', async () => {
      prisma.commissionConfig.findFirst.mockResolvedValue({ id: 'cc-1', percentage: 10 } as any);

      const result = await service.getCurrent();

      expect(result).toEqual({ id: 'cc-1', percentage: 10 });
    });

    it('lanza NotFoundException si no hay ninguna configuración activa', async () => {
      prisma.commissionConfig.findFirst.mockResolvedValue(null);

      await expect(service.getCurrent()).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('desactiva la configuración anterior y crea la nueva como activa', async () => {
      const previouslyActive = { id: 'cc-old', percentage: 7.5 };
      prisma.commissionConfig.findFirst.mockResolvedValue(previouslyActive as any);
      prisma.commissionConfig.update.mockResolvedValue({} as any);
      prisma.commissionConfig.create.mockResolvedValue({ id: 'cc-new', percentage: 10 } as any);

      const result = await service.create('admin-1', { percentage: 10 } as any);

      // La anterior se desactivó y se le puso effectiveTo
      expect(prisma.commissionConfig.update).toHaveBeenCalledWith({
        where: { id: 'cc-old' },
        data: { isActive: false, effectiveTo: expect.any(Date) },
      });

      // La nueva se creó como activa, con el admin correcto
      expect(prisma.commissionConfig.create).toHaveBeenCalledWith({
        data: {
          percentage: 10,
          effectiveFrom: expect.any(Date),
          isActive: true,
          createdBy: 'admin-1',
        },
      });

      // Y quedó registrada en la bitácora de auditoría con el porcentaje anterior y el nuevo
      expect(auditLogService.log).toHaveBeenCalledWith(
        'admin-1',
        'COMMISSION_CONFIG_CREATED',
        'CommissionConfig',
        'cc-new',
        { percentage: 7.5 },
        { percentage: 10 },
      );

      expect(result).toEqual({ id: 'cc-new', percentage: 10 });
    });

    it('si no había ninguna configuración activa, crea la primera sin intentar desactivar nada', async () => {
      prisma.commissionConfig.findFirst.mockResolvedValue(null);
      prisma.commissionConfig.create.mockResolvedValue({ id: 'cc-first', percentage: 5 } as any);

      await service.create('admin-1', { percentage: 5 } as any);

      expect(prisma.commissionConfig.update).not.toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalledWith(
        'admin-1',
        'COMMISSION_CONFIG_CREATED',
        'CommissionConfig',
        'cc-first',
        undefined,
        { percentage: 5 },
      );
    });
  });

  describe('listHistory', () => {
    it('retorna los resultados paginados', async () => {
      prisma.commissionConfig.findMany.mockResolvedValue([{ id: 'cc-1' }] as any);
      prisma.commissionConfig.count.mockResolvedValue(1);

      const result = await service.listHistory({ page: 1, limit: 10 } as any);

      expect(result).toEqual({ data: [{ id: 'cc-1' }], total: 1, page: 1, limit: 10 });
    });
  });
});
