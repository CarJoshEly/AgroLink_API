import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  ApiCommonErrorResponses,
  ApiOkResponseData,
  CurrentUser,
  Roles,
} from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { OrdersService } from './orders.service';
import { ListOrdersQueryDto, RejectOrderDto } from './dto';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@ApiCommonErrorResponses()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ---- Rutas literales (deben ir antes de :id) ----

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos los pedidos de la plataforma (admin)' })
  @ApiOkResponseData()
  findAll(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('mine')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Ver mis solicitudes de compra (comprador)' })
  @ApiOkResponseData()
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.findMine(user.sub, query);
  }

  @Get('received')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Ver las solicitudes de compra recibidas (vendedor)' })
  @ApiOkResponseData()
  findReceived(@CurrentUser() user: JwtPayload, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.findReceived(user.sub, query);
  }

  @Get('dashboard')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Dashboard de pedidos del vendedor' })
  @ApiOkResponseData()
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.ordersService.getDashboard(user.sub);
  }

  // ---- Rutas con :id ----

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ver el detalle de un pedido' })
  @ApiOkResponseData()
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.findById(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Get(':id/history')
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ver el historial de estados de un pedido' })
  @ApiOkResponseData()
  getHistory(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.getHistory(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Patch(':id/accept')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aceptar una solicitud de compra (vendedor)' })
  @ApiOkResponseData()
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.accept(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Patch(':id/reject')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Rechazar una solicitud de compra (vendedor)' })
  @ApiOkResponseData(RejectOrderDto)
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RejectOrderDto) {
    return this.ordersService.reject(id, { userId: user.sub, role: user.role as UserRole }, dto);
  }

  @Patch(':id/prepare')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Marcar un pedido como en preparación (vendedor)' })
  @ApiOkResponseData()
  prepare(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.prepare(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Patch(':id/deliver')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Marcar un pedido como entregado (vendedor)' })
  @ApiOkResponseData()
  deliver(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.deliver(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Patch(':id/cancel')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancelar un pedido confirmado o en preparación (vendedor)' })
  @ApiOkResponseData(RejectOrderDto)
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RejectOrderDto) {
    return this.ordersService.cancel(id, { userId: user.sub, role: user.role as UserRole }, dto);
  }
}
