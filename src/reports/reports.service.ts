import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, ReportTargetType, UserRole } from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { CreateReportDto, ListReportsQueryDto, UpdateReportStatusDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });
    await this.notificationsService.createMany(
      admins.map((a) => a.id),
      NotificationType.REPORT_RECEIVED,
      'Nuevo reporte recibido',
      `Se ha recibido un reporte sobre ${dto.targetType}: ${dto.reason}`,
    );

    return report;
  }

  async findAll(query: ListReportsQueryDto) {
    const where: Prisma.ReportWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.report.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async updateStatus(id: string, adminId: string, dto: UpdateReportStatusDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Reporte no encontrado');

    return this.prisma.report.update({
      where: { id },
      data: { status: dto.status, resolvedAt: new Date(), resolvedBy: adminId },
    });
  }

  private async assertTargetExists(targetType: ReportTargetType, targetId: string): Promise<void> {
    switch (targetType) {
      case ReportTargetType.PRODUCT: {
        const exists = await this.prisma.product.findUnique({ where: { id: targetId } });
        if (!exists) throw new NotFoundException('Producto no encontrado');
        return;
      }
      case ReportTargetType.SELLER: {
        const exists = await this.prisma.sellerProfile.findUnique({ where: { id: targetId } });
        if (!exists) throw new NotFoundException('Vendedor no encontrado');
        return;
      }
      case ReportTargetType.PRODUCT_REVIEW: {
        const exists = await this.prisma.productReview.findUnique({ where: { id: targetId } });
        if (!exists) throw new NotFoundException('Reseña de producto no encontrada');
        return;
      }
      case ReportTargetType.SELLER_REVIEW: {
        const exists = await this.prisma.sellerReview.findUnique({ where: { id: targetId } });
        if (!exists) throw new NotFoundException('Reseña de vendedor no encontrada');
        return;
      }
      default:
        return;
    }
  }
}
