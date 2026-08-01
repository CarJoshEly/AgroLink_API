import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../database';
import { PaginationDto } from '../common/dto';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async addProductFavorite(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('El producto no está disponible');
    }
    return this.createFavorite({ userId, productId }, 'Ya tienes este producto en tus favoritos');
  }

  async removeProductFavorite(userId: string, productId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!favorite) throw new NotFoundException('No tienes este producto en tus favoritos');
    await this.prisma.favorite.delete({ where: { id: favorite.id } });
    return { message: 'Producto eliminado de favoritos' };
  }

  async listFavoriteProducts(userId: string, query: PaginationDto) {
    const where = { userId, productId: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              images: { take: 1, orderBy: { order: 'asc' } },
              seller: { select: { id: true, businessName: true, verificationStatus: true } },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async addSellerFavorite(userId: string, sellerId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Vendedor no encontrado');
    if (seller.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException('El vendedor no está disponible');
    }
    return this.createFavorite({ userId, sellerId }, 'Ya tienes este vendedor en tus favoritos');
  }

  async removeSellerFavorite(userId: string, sellerId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_sellerId: { userId, sellerId } },
    });
    if (!favorite) throw new NotFoundException('No tienes este vendedor en tus favoritos');
    await this.prisma.favorite.delete({ where: { id: favorite.id } });
    return { message: 'Vendedor eliminado de favoritos' };
  }

  async listFavoriteSellers(userId: string, query: PaginationDto) {
    const where = { userId, sellerId: { not: null } };
    const [data, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, businessName: true, verificationStatus: true } },
        },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  private async createFavorite(
    data: { userId: string; productId: string } | { userId: string; sellerId: string },
    duplicateMessage: string,
  ) {
    try {
      return await this.prisma.favorite.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(duplicateMessage);
      }
      throw error;
    }
  }
}
