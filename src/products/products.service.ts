import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  ProductImage,
  ProductStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../database';
import { StorageService } from '../storage';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto, UpdateStockDto } from './dto';

export type Actor = { userId: string; role: UserRole };

const PUBLIC_SELLER_SELECT = { id: true, businessName: true, verificationStatus: true } as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // --------------------------------------------------------------------
  // CREACIÓN
  // --------------------------------------------------------------------

  async create(sellerUserId: string, dto: CreateProductDto) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!sellerProfile || sellerProfile.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException('Solo los vendedores verificados pueden publicar productos');
    }
    await this.assertCategoryUsable(dto.categoryId);

    return this.prisma.product.create({
      data: {
        sellerId: sellerProfile.id,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        unit: dto.unit,
        stock: dto.stock,
        status: dto.stock === 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE,
      },
    });
  }

  // --------------------------------------------------------------------
  // BÚSQUEDA / LISTADO
  // --------------------------------------------------------------------

  async findMany(query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...this.buildFilters(query),
      status: ProductStatus.ACTIVE,
      seller: { verificationStatus: VerificationStatus.VERIFIED },
    };
    return this.paginate(where, query);
  }

  async findMine(sellerUserId: string, query: ListProductsQueryDto) {
    const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId: sellerUserId } });
    if (!sellerProfile) throw new ForbiddenException('No tienes un perfil de vendedor');

    const where: Prisma.ProductWhereInput = {
      ...this.buildFilters(query),
      sellerId: sellerProfile.id,
    };
    return this.paginate(where, query);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: 'asc' } },
        category: true,
        seller: { select: PUBLIC_SELLER_SELECT },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  // --------------------------------------------------------------------
  // ACTUALIZACIÓN
  // --------------------------------------------------------------------

  async update(id: string, actor: Actor, dto: UpdateProductDto) {
    await this.getOwnedProduct(id, actor);
    if (dto.categoryId) await this.assertCategoryUsable(dto.categoryId);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.unit ? { unit: dto.unit } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async updateStock(id: string, actor: Actor, dto: UpdateStockDto) {
    const product = await this.getOwnedProduct(id, actor);
    const previousStock = product.stock;

    let status = product.status;
    if (dto.stock === 0 && product.status === ProductStatus.ACTIVE) {
      status = ProductStatus.OUT_OF_STOCK;
    } else if (dto.stock > 0 && product.status === ProductStatus.OUT_OF_STOCK) {
      status = ProductStatus.ACTIVE;
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: dto.stock, status },
    });

    if (dto.stock !== previousStock) {
      await this.prisma.inventoryMovement.create({
        data: {
          productId: id,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: dto.stock - previousStock,
          previousStock,
          newStock: dto.stock,
          createdBy: actor.userId,
        },
      });
    }

    return updated;
  }

  async remove(id: string, actor: Actor) {
    await this.getOwnedProduct(id, actor);
    await this.prisma.product.delete({ where: { id } }); // soft delete (extensión en prisma.service.ts)
    return { message: 'Producto eliminado' };
  }

  // --------------------------------------------------------------------
  // IMÁGENES
  // --------------------------------------------------------------------

  async addImages(id: string, actor: Actor, files?: Express.Multer.File[]) {
    await this.getOwnedProduct(id, actor);
    if (!files || files.length === 0) {
      throw new BadRequestException('Debes proporcionar al menos una imagen');
    }

    const currentMax = await this.prisma.productImage.aggregate({
      where: { productId: id },
      _max: { order: true },
    });
    let nextOrder = (currentMax._max.order ?? -1) + 1;

    const created: ProductImage[] = [];
    for (const file of files) {
      const url = await this.storageService.uploadImage(file, `products/${id}`);
      created.push(
        await this.prisma.productImage.create({ data: { productId: id, url, order: nextOrder++ } }),
      );
    }
    return created;
  }

  async removeImage(id: string, imageId: string, actor: Actor) {
    await this.getOwnedProduct(id, actor);
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== id) throw new NotFoundException('Imagen no encontrada');

    await this.storageService.deleteImage(image.url);
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { message: 'Imagen eliminada' };
  }

  // --------------------------------------------------------------------
  // HELPERS PRIVADOS
  // --------------------------------------------------------------------

  private buildFilters(query: ListProductsQueryDto): Prisma.ProductWhereInput {
    return {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.unit ? { unit: query.unit } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
    };
  }

  private async paginate(where: Prisma.ProductWhereInput, query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        include: {
          images: { orderBy: { order: 'asc' }, take: 1 },
          category: true,
          seller: { select: PUBLIC_SELLER_SELECT },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  private async assertCategoryUsable(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) {
      throw new BadRequestException('La categoría seleccionada no existe o no está activa');
    }
  }

  async getOwnedProduct(id: string, actor: Actor) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (actor.role !== UserRole.ADMIN && product.seller.userId !== actor.userId) {
      throw new ForbiddenException('No tienes permiso para modificar este producto');
    }
    return product;
  }
}
