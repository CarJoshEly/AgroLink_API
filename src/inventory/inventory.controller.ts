import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { InventoryService } from './inventory.service';
import { CreateEntryDto, CreateExitDto, ListMovementsQueryDto } from './dto';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@ApiCommonErrorResponses()
@Roles(UserRole.SELLER, UserRole.ADMIN)
@Controller('products/:productId/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('entries')
  @ApiOperation({ summary: 'Registrar una entrada de inventario (restock)' })
  @ApiCreatedResponseData(CreateEntryDto)
  registerEntry(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEntryDto,
  ) {
    return this.inventoryService.registerEntry(productId, { userId: user.sub, role: user.role as UserRole }, dto);
  }

  @Post('exits')
  @ApiOperation({ summary: 'Registrar una salida de inventario' })
  @ApiCreatedResponseData(CreateExitDto)
  registerExit(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExitDto,
  ) {
    return this.inventoryService.registerExit(productId, { userId: user.sub, role: user.role as UserRole }, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Ver el historial de movimientos de inventario de un producto' })
  @ApiOkResponseData()
  listHistory(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMovementsQueryDto,
  ) {
    return this.inventoryService.listHistory(
      productId,
      { userId: user.sub, role: user.role as UserRole },
      query,
    );
  }
}
