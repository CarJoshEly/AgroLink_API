import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database';
import { AuditLogService } from '../audit';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  listAll() {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async getByKey(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException('Configuración no encontrada');
    return config;
  }

  async upsert(key: string, value: unknown, adminId: string) {
    const existing = await this.prisma.systemConfig.findUnique({ where: { key } });

    const updated = await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, updatedBy: adminId },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: adminId },
    });

    await this.auditLogService.log(
      adminId,
      'CONFIG_UPDATED',
      'SystemConfig',
      key,
      existing?.value,
      updated.value,
    );

    return updated;
  }
}
