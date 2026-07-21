import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database';
import { AuditLogService } from '../audit';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  listActive() {
    return this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      select: { id: true, name: true, provider: true },
      orderBy: { name: 'asc' },
    });
  }

  listAll() {
    return this.prisma.paymentMethod.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreatePaymentMethodDto, adminId: string) {
    const created = await this.prisma.paymentMethod.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        isActive: dto.isActive ?? true,
        config: dto.config as Prisma.InputJsonValue,
      },
    });
    await this.auditLogService.log(
      adminId,
      'PAYMENT_METHOD_CREATED',
      'PaymentMethod',
      created.id,
      undefined,
      { name: created.name, provider: created.provider, isActive: created.isActive },
    );
    return created;
  }

  async update(id: string, dto: UpdatePaymentMethodDto, adminId: string) {
    const previous = await this.assertExists(id);
    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
      },
    });
    await this.auditLogService.log(
      adminId,
      'PAYMENT_METHOD_UPDATED',
      'PaymentMethod',
      id,
      { name: previous.name, provider: previous.provider, isActive: previous.isActive },
      { name: updated.name, provider: updated.provider, isActive: updated.isActive },
    );
    return updated;
  }

  private async assertExists(id: string) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundException('Método de pago no encontrado');
    return method;
  }
}
