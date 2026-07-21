import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { PaginationDto } from '../common/dto';
import { ReviewsService } from './reviews.service';
import {
  CreateProductReviewDto,
  CreateSellerReviewDto,
  ListProductReviewsQueryDto,
  ListSellerReviewsQueryDto,
  ModerateReviewDto,
  UpdateProductReviewDto,
  UpdateSellerReviewDto,
} from './dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ---- Reseñas de producto ----

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Listar reseñas aprobadas de un producto' })
  listProductReviews(@Query() query: ListProductReviewsQueryDto) {
    return this.reviewsService.listProductReviews(query);
  }

  @Get('products/pending')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cola de moderación de reseñas de producto (admin)' })
  listPendingProductReviews(@Query() query: PaginationDto) {
    return this.reviewsService.listPendingProductReviews(query);
  }

  @Public()
  @Get('products/:productId/summary')
  @ApiOperation({ summary: 'Resumen de calificación de un producto' })
  getProductSummary(@Param('productId') productId: string) {
    return this.reviewsService.getProductSummary(productId);
  }

  @Post('products')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear una reseña de producto (solo pedidos entregados)' })
  createProductReview(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductReviewDto) {
    return this.reviewsService.createProductReview(user.sub, dto);
  }

  @Patch('products/:id')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Editar mi reseña de producto' })
  updateProductReview(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProductReviewDto,
  ) {
    return this.reviewsService.updateProductReview(id, user.sub, dto);
  }

  @Patch('products/:id/moderate')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Aprobar o rechazar una reseña de producto (admin)' })
  moderateProductReview(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.moderateProductReview(id, dto, user.sub);
  }

  @Delete('products/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar una reseña de producto' })
  deleteProductReview(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reviewsService.deleteProductReview(id, { userId: user.sub, role: user.role as UserRole });
  }

  // ---- Reseñas de vendedor ----

  @Public()
  @Get('sellers')
  @ApiOperation({ summary: 'Listar reseñas aprobadas de un vendedor' })
  listSellerReviews(@Query() query: ListSellerReviewsQueryDto) {
    return this.reviewsService.listSellerReviews(query);
  }

  @Get('sellers/pending')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cola de moderación de reseñas de vendedor (admin)' })
  listPendingSellerReviews(@Query() query: PaginationDto) {
    return this.reviewsService.listPendingSellerReviews(query);
  }

  @Public()
  @Get('sellers/:sellerId/summary')
  @ApiOperation({ summary: 'Resumen de reputación de un vendedor' })
  getSellerSummary(@Param('sellerId') sellerId: string) {
    return this.reviewsService.getSellerSummary(sellerId);
  }

  @Post('sellers')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear una reseña de vendedor (solo pedidos entregados)' })
  createSellerReview(@CurrentUser() user: JwtPayload, @Body() dto: CreateSellerReviewDto) {
    return this.reviewsService.createSellerReview(user.sub, dto);
  }

  @Patch('sellers/:id')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Editar mi reseña de vendedor' })
  updateSellerReview(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSellerReviewDto,
  ) {
    return this.reviewsService.updateSellerReview(id, user.sub, dto);
  }

  @Patch('sellers/:id/moderate')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Aprobar o rechazar una reseña de vendedor (admin)' })
  moderateSellerReview(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.moderateSellerReview(id, dto, user.sub);
  }

  @Delete('sellers/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar una reseña de vendedor' })
  deleteSellerReview(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reviewsService.deleteSellerReview(id, { userId: user.sub, role: user.role as UserRole });
  }
}
