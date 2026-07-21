import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database';
import { AuditLogService } from '../audit';
import { PaginationDto } from '../common/dto';
import { CreateCommissionConfigDto } from './dto';

@Injectable()
export class CommissionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getCurrent() {
    const current = await this.prisma.commissionConfig.findFirst({
      where: { isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!current) throw new NotFoundException('No hay una configuración de comisión activa');
    return current;
  }

  async listHistory(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.commissionConfig.findMany({
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.commissionConfig.count(),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async create(adminId: string, dto: CreateCommissionConfigDto) {
    const { created, previousPercentage } = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const previouslyActive = await tx.commissionConfig.findFirst({ where: { isActive: true } });
      if (previouslyActive) {
        await tx.commissionConfig.update({
          where: { id: previouslyActive.id },
          data: { isActive: false, effectiveTo: now },
        });
      }

      const created = await tx.commissionConfig.create({
        data: {
          percentage: dto.percentage,
          effectiveFrom: now,
          isActive: true,
          createdBy: adminId,
        },
      });

      return {
        created,
        previousPercentage: previouslyActive ? Number(previouslyActive.percentage) : null,
      };
    });

    await this.auditLogService.log(
      adminId,
      'COMMISSION_CONFIG_CREATED',
      'CommissionConfig',
      created.id,
      previousPercentage === null ? undefined : { percentage: previousPercentage },
      { percentage: Number(created.percentage) },
    );

    return created;
  }
}
