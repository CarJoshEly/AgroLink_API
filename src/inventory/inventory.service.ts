import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType, ProductStatus } from '@prisma/client';
import { PrismaService } from '../database';
import { Actor, ProductsService } from '../products';
import { CreateEntryDto, CreateExitDto, ListMovementsQueryDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async registerEntry(productId: string, actor: Actor, dto: CreateEntryDto) {
    const product = await this.productsService.getOwnedProduct(productId, actor);
    const previousStock = product.stock;
    const newStock = previousStock + dto.quantity;
    const status = product.status === ProductStatus.OUT_OF_STOCK ? ProductStatus.ACTIVE : product.status;

    await this.prisma.product.update({ where: { id: productId }, data: { stock: newStock, status } });

    return this.prisma.inventoryMovement.create({
      data: {
        productId,
        type: InventoryMovementType.ENTRY,
        quantity: dto.quantity,
        previousStock,
        newStock,
        reason: dto.reason,
        createdBy: actor.userId,
      },
    });
  }

  async registerExit(productId: string, actor: Actor, dto: CreateExitDto) {
    const product = await this.productsService.getOwnedProduct(productId, actor);
    const previousStock = product.stock;

    if (dto.quantity > previousStock) {
      throw new BadRequestException(
        `No puedes retirar ${dto.quantity} unidades: solo hay ${previousStock} en existencia`,
      );
    }

    const newStock = previousStock - dto.quantity;
    const status =
      newStock === 0 && product.status === ProductStatus.ACTIVE ? ProductStatus.OUT_OF_STOCK : product.status;

    await this.prisma.product.update({ where: { id: productId }, data: { stock: newStock, status } });

    return this.prisma.inventoryMovement.create({
      data: {
        productId,
        type: InventoryMovementType.EXIT,
        quantity: dto.quantity,
        previousStock,
        newStock,
        reason: dto.reason,
        createdBy: actor.userId,
      },
    });
  }

  async listHistory(productId: string, actor: Actor, query: ListMovementsQueryDto) {
    await this.productsService.getOwnedProduct(productId, actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { productId },
        skip: query.skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryMovement.count({ where: { productId } }),
    ]);

    return { data, total, page, limit };
  }
}
