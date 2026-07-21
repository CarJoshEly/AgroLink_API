import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { PaginationDto } from '../common/dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@ApiBearerAuth('access-token')
@Roles(UserRole.CUSTOMER)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('products')
  @ApiOperation({ summary: 'Listar mis productos favoritos' })
  listFavoriteProducts(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.favoritesService.listFavoriteProducts(user.sub, query);
  }

  @Post('products/:productId')
  @ApiOperation({ summary: 'Agregar un producto a mis favoritos' })
  addProductFavorite(@Param('productId') productId: string, @CurrentUser() user: JwtPayload) {
    return this.favoritesService.addProductFavorite(user.sub, productId);
  }

  @Delete('products/:productId')
  @ApiOperation({ summary: 'Eliminar un producto de mis favoritos' })
  removeProductFavorite(@Param('productId') productId: string, @CurrentUser() user: JwtPayload) {
    return this.favoritesService.removeProductFavorite(user.sub, productId);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Listar mis vendedores favoritos' })
  listFavoriteSellers(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.favoritesService.listFavoriteSellers(user.sub, query);
  }

  @Post('sellers/:sellerId')
  @ApiOperation({ summary: 'Agregar un vendedor a mis favoritos' })
  addSellerFavorite(@Param('sellerId') sellerId: string, @CurrentUser() user: JwtPayload) {
    return this.favoritesService.addSellerFavorite(user.sub, sellerId);
  }

  @Delete('sellers/:sellerId')
  @ApiOperation({ summary: 'Eliminar un vendedor de mis favoritos' })
  removeSellerFavorite(@Param('sellerId') sellerId: string, @CurrentUser() user: JwtPayload) {
    return this.favoritesService.removeSellerFavorite(user.sub, sellerId);
  }
}
