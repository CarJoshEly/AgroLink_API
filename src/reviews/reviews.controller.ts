import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  ApiCommonErrorResponses,
  ApiCreatedResponseData,
  ApiOkResponseData,
  CurrentUser,
  Public,
  Roles,
} from '../common/decorators';
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
@ApiCommonErrorResponses()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ---- Reseñas de producto ----

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Listar reseñas aprobadas de un producto' })
  @ApiOkResponseData()
  listProductReviews(@Query() query: ListProductReviewsQueryDto) {
    return this.reviewsService.listProductReviews(query);
  }

  @Get('products/moderation')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar reseñas de producto para moderación (admin) — se publican solas, esto es para retirar las que incumplan las normas' })
  @ApiOkResponseData()
  listProductReviewsForAdmin(@Query() query: PaginationDto) {
    return this.reviewsService.listProductReviewsForAdmin(query);
  }

  @Public()
  @Get('products/:productId/summary')
  @ApiOperation({ summary: 'Resumen de calificación de un producto' })
  @ApiOkResponseData()
  getProductSummary(@Param('productId') productId: string) {
    return this.reviewsService.getProductSummary(productId);
  }

  @Post('products')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear una reseña de producto (solo pedidos entregados)' })
  @ApiCreatedResponseData(CreateProductReviewDto)
  createProductReview(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductReviewDto) {
    return this.reviewsService.createProductReview(user.sub, dto);
  }

  @Patch('products/:id')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Editar mi reseña de producto' })
  @ApiOkResponseData(UpdateProductReviewDto)
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
  @ApiOkResponseData(ModerateReviewDto)
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
  @ApiOkResponseData()
  deleteProductReview(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reviewsService.deleteProductReview(id, { userId: user.sub, role: user.role as UserRole });
  }

  // ---- Reseñas de vendedor ----

  @Public()
  @Get('sellers')
  @ApiOperation({ summary: 'Listar reseñas aprobadas de un vendedor' })
  @ApiOkResponseData()
  listSellerReviews(@Query() query: ListSellerReviewsQueryDto) {
    return this.reviewsService.listSellerReviews(query);
  }

  @Get('sellers/moderation')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar reseñas de vendedor para moderación (admin) — se publican solas, esto es para retirar las que incumplan las normas' })
  @ApiOkResponseData()
  listSellerReviewsForAdmin(@Query() query: PaginationDto) {
    return this.reviewsService.listSellerReviewsForAdmin(query);
  }

  @Public()
  @Get('sellers/:sellerId/summary')
  @ApiOperation({ summary: 'Resumen de reputación de un vendedor' })
  @ApiOkResponseData()
  getSellerSummary(@Param('sellerId') sellerId: string) {
    return this.reviewsService.getSellerSummary(sellerId);
  }

  @Post('sellers')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear una reseña de vendedor (solo pedidos entregados)' })
  @ApiCreatedResponseData(CreateSellerReviewDto)
  createSellerReview(@CurrentUser() user: JwtPayload, @Body() dto: CreateSellerReviewDto) {
    return this.reviewsService.createSellerReview(user.sub, dto);
  }

  @Patch('sellers/:id')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Editar mi reseña de vendedor' })
  @ApiOkResponseData(UpdateSellerReviewDto)
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
  @ApiOkResponseData(ModerateReviewDto)
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
  @ApiOkResponseData()
  deleteSellerReview(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reviewsService.deleteSellerReview(id, { userId: user.sub, role: user.role as UserRole });
  }
}
