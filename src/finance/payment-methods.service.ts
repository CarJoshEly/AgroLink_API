import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(dto: CreatePaymentMethodDto) {
    return this.prisma.paymentMethod.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        isActive: dto.isActive ?? true,
        config: dto.config as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdatePaymentMethodDto) {
    await this.assertExists(id);
    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private async assertExists(id: string): Promise<void> {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundException('Método de pago no encontrado');
  }
}
