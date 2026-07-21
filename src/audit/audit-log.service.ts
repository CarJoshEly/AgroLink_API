import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database';
import { ListAuditLogsQueryDto } from './dto';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        entityType,
        entityId,
        oldValue: oldValue === undefined ? Prisma.JsonNull : (oldValue as Prisma.InputJsonValue),
        newValue: newValue === undefined ? Prisma.JsonNull : (newValue as Prisma.InputJsonValue),
      },
    });
  }

  async findAll(query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }
}
