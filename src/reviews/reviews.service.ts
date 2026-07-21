import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, OrderStatus, ReviewModerationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database';
import { NotificationsService } from '../notifications';
import { PaginationDto } from '../common/dto';
import {
  CreateProductReviewDto,
  CreateSellerReviewDto,
  ListProductReviewsQueryDto,
  ListSellerReviewsQueryDto,
  ModerateReviewDto,
  UpdateProductReviewDto,
  UpdateSellerReviewDto,
} from './dto';

type Actor = { userId: string; role: UserRole };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --------------------------------------------------------------------
  // CREACIÓN
  // --------------------------------------------------------------------

  async createProductReview(buyerId: string, dto: CreateProductReviewDto) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: { include: { seller: true } } },
    });
    if (!orderItem) throw new NotFoundException('Artículo de pedido no encontrado');
    if (orderItem.order.buyerId !== buyerId) {
      throw new ForbiddenException('No puedes reseñar un pedido que no es tuyo');
    }
    if (orderItem.order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Solo puedes reseñar productos de pedidos entregados');
    }

    const review = await this.prisma.productReview.create({
      data: {
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        productId: orderItem.productId,
        buyerId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    await this.notificationsService.create(
      orderItem.order.seller.userId,
      NotificationType.NEW_REVIEW,
      'Nueva reseña recibida',
      'Un comprador ha dejado una reseña sobre uno de tus productos.',
    );

    return review;
  }

  async createSellerReview(buyerId: string, dto: CreateSellerReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { seller: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('No puedes reseñar un pedido que no es tuyo');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Solo puedes reseñar vendedores de pedidos entregados');
    }

    const review = await this.prisma.sellerReview.create({
      data: {
        orderId: order.id,
        sellerId: order.sellerId,
        buyerId,
        qualityScore: dto.qualityScore,
        responseTimeScore: dto.responseTimeScore,
        complianceScore: dto.complianceScore,
        attentionScore: dto.attentionScore,
        trustScore: dto.trustScore,
        comment: dto.comment,
      },
    });

    await this.notificationsService.create(
      order.seller.userId,
      NotificationType.NEW_REVIEW,
      'Nueva reseña recibida',
      'Un comprador ha dejado una reseña sobre tu perfil de vendedor.',
    );

    return review;
  }

  // --------------------------------------------------------------------
  // EDICIÓN / ELIMINACIÓN
  // --------------------------------------------------------------------

  async updateProductReview(id: string, buyerId: string, dto: UpdateProductReviewDto) {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    if (review.buyerId !== buyerId) throw new ForbiddenException('No puedes editar esta reseña');

    return this.prisma.productReview.update({
      where: { id },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        moderationStatus: ReviewModerationStatus.PENDING_REVIEW,
      },
    });
  }

  async updateSellerReview(id: string, buyerId: string, dto: UpdateSellerReviewDto) {
    const review = await this.prisma.sellerReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    if (review.buyerId !== buyerId) throw new ForbiddenException('No puedes editar esta reseña');

    return this.prisma.sellerReview.update({
      where: { id },
      data: {
        ...(dto.qualityScore !== undefined ? { qualityScore: dto.qualityScore } : {}),
        ...(dto.responseTimeScore !== undefined ? { responseTimeScore: dto.responseTimeScore } : {}),
        ...(dto.complianceScore !== undefined ? { complianceScore: dto.complianceScore } : {}),
        ...(dto.attentionScore !== undefined ? { attentionScore: dto.attentionScore } : {}),
        ...(dto.trustScore !== undefined ? { trustScore: dto.trustScore } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        moderationStatus: ReviewModerationStatus.PENDING_REVIEW,
      },
    });
  }

  async deleteProductReview(id: string, actor: Actor) {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    if (actor.role !== UserRole.ADMIN && review.buyerId !== actor.userId) {
      throw new ForbiddenException('No puedes eliminar esta reseña');
    }
    await this.prisma.productReview.delete({ where: { id } });
    return { message: 'Reseña eliminada' };
  }

  async deleteSellerReview(id: string, actor: Actor) {
    const review = await this.prisma.sellerReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    if (actor.role !== UserRole.ADMIN && review.buyerId !== actor.userId) {
      throw new ForbiddenException('No puedes eliminar esta reseña');
    }
    await this.prisma.sellerReview.delete({ where: { id } });
    return { message: 'Reseña eliminada' };
  }

  // --------------------------------------------------------------------
  // CONSULTA PÚBLICA
  // --------------------------------------------------------------------

  async listProductReviews(query: ListProductReviewsQueryDto) {
    const where = { productId: query.productId, moderationStatus: ReviewModerationStatus.APPROVED };
    const [data, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { id: true, name: true } } },
      }),
      this.prisma.productReview.count({ where }),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async listSellerReviews(query: ListSellerReviewsQueryDto) {
    const where = { sellerId: query.sellerId, moderationStatus: ReviewModerationStatus.APPROVED };
    const [data, total] = await Promise.all([
      this.prisma.sellerReview.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { id: true, name: true } } },
      }),
      this.prisma.sellerReview.count({ where }),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async getProductSummary(productId: string) {
    const agg = await this.prisma.productReview.aggregate({
      where: { productId, moderationStatus: ReviewModerationStatus.APPROVED },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      productId,
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : null,
      totalReviews: agg._count._all,
    };
  }

  async getSellerSummary(sellerId: string) {
    const agg = await this.prisma.sellerReview.aggregate({
      where: { sellerId, moderationStatus: ReviewModerationStatus.APPROVED },
      _avg: {
        qualityScore: true,
        responseTimeScore: true,
        complianceScore: true,
        attentionScore: true,
        trustScore: true,
      },
      _count: { _all: true },
    });

    const round = (n: number | null) => (n === null ? null : Number(n.toFixed(2)));
    const dimensionAverages = [
      agg._avg.qualityScore,
      agg._avg.responseTimeScore,
      agg._avg.complianceScore,
      agg._avg.attentionScore,
      agg._avg.trustScore,
    ];
    const defined = dimensionAverages.filter((v): v is number => v !== null);
    const overall = defined.length ? defined.reduce((a, b) => a + b, 0) / defined.length : null;

    return {
      sellerId,
      averageQuality: round(agg._avg.qualityScore),
      averageResponseTime: round(agg._avg.responseTimeScore),
      averageCompliance: round(agg._avg.complianceScore),
      averageAttention: round(agg._avg.attentionScore),
      averageTrust: round(agg._avg.trustScore),
      averageOverall: round(overall),
      totalReviews: agg._count._all,
    };
  }

  // --------------------------------------------------------------------
  // MODERACIÓN (ADMIN)
  // --------------------------------------------------------------------

  async listPendingProductReviews(query: PaginationDto) {
    const where = { moderationStatus: ReviewModerationStatus.PENDING_REVIEW };
    const [data, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productReview.count({ where }),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async listPendingSellerReviews(query: PaginationDto) {
    const where = { moderationStatus: ReviewModerationStatus.PENDING_REVIEW };
    const [data, total] = await Promise.all([
      this.prisma.sellerReview.findMany({
        where,
        skip: query.skip,
        take: query.limit ?? 10,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.sellerReview.count({ where }),
    ]);
    return { data, total, page: query.page ?? 1, limit: query.limit ?? 10 };
  }

  async moderateProductReview(id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    return this.prisma.productReview.update({ where: { id }, data: { moderationStatus: dto.status } });
  }

  async moderateSellerReview(id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.sellerReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    return this.prisma.sellerReview.update({ where: { id }, data: { moderationStatus: dto.status } });
  }
}
