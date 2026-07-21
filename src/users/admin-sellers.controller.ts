import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { UsersService } from './users.service';
import { ListSellersQueryDto, RejectSellerDto, SuspendSellerDto } from './dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin/sellers')
export class AdminSellersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar vendedores (panel de verificación)' })
  listSellers(@Query() query: ListSellersQueryDto) {
    return this.usersService.listSellers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver el detalle de un vendedor, incluyendo documentos de identidad' })
  getSellerById(@Param('id') id: string) {
    return this.usersService.getSellerById(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Marcar un vendedor como en revisión' })
  markUnderReview(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.usersService.markSellerUnderReview(id, admin.sub);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Aprobar un vendedor' })
  approve(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.usersService.approveSeller(id, admin.sub);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar un vendedor' })
  reject(@Param('id') id: string, @CurrentUser() admin: JwtPayload, @Body() dto: RejectSellerDto) {
    return this.usersService.rejectSeller(id, admin.sub, dto);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspender un vendedor' })
  suspend(@Param('id') id: string, @CurrentUser() admin: JwtPayload, @Body() dto: SuspendSellerDto) {
    return this.usersService.suspendSeller(id, admin.sub, dto);
  }
}
