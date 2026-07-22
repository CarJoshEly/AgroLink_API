import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  ApiCommonErrorResponses,
  ApiCreatedResponseData,
  ApiOkResponseData,
  CurrentUser,
  Roles,
} from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { OrdersService } from '../orders';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@ApiCommonErrorResponses()
@Roles(UserRole.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ver mi carrito' })
  @ApiOkResponseData()
  getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCart(user.sub);
  }

  @Post('items')
  @ApiOperation({ summary: 'Agregar un producto al carrito' })
  @ApiCreatedResponseData(AddCartItemDto)
  addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.sub, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Editar la cantidad de un producto en el carrito' })
  @ApiOkResponseData(UpdateCartItemDto)
  updateItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(user.sub, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Eliminar un producto del carrito' })
  @ApiOkResponseData()
  removeItem(@Param('itemId') itemId: string, @CurrentUser() user: JwtPayload) {
    return this.cartService.removeItem(user.sub, itemId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Generar solicitud(es) de compra a partir del carrito' })
  @ApiCreatedResponseData()
  checkout(@CurrentUser() user: JwtPayload) {
    return this.ordersService.checkout(user.sub);
  }
}
