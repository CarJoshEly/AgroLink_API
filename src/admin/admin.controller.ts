import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  ApiCommonErrorResponses,
  ApiOkResponseData,
  CurrentUser,
  Roles,
} from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { ListProductsQueryDto } from '../products/dto';
import { ProductsService } from '../products';
import { AuditLogService } from '../audit';
import { ListAuditLogsQueryDto } from '../audit/dto';
import { AdminStatsService } from './admin-stats.service';
import { SystemConfigService } from './system-config.service';
import { UpsertSystemConfigDto } from './dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@ApiCommonErrorResponses()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminStatsService: AdminStatsService,
    private readonly auditLogService: AuditLogService,
    private readonly systemConfigService: SystemConfigService,
    private readonly productsService: ProductsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Estadísticas y dashboard general de la plataforma (admin)' })
  @ApiOkResponseData()
  getDashboard() {
    return this.adminStatsService.getDashboard();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Consultar el historial de auditoría (admin)' })
  @ApiOkResponseData()
  findAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogService.findAll(query);
  }

  @Get('config')
  @ApiOperation({ summary: 'Listar toda la configuración del sistema (admin)' })
  @ApiOkResponseData()
  listConfig() {
    return this.systemConfigService.listAll();
  }

  @Get('config/:key')
  @ApiOperation({ summary: 'Ver una configuración específica del sistema (admin)' })
  @ApiOkResponseData()
  getConfig(@Param('key') key: string) {
    return this.systemConfigService.getByKey(key);
  }

  @Put('config/:key')
  @ApiOperation({ summary: 'Crear o actualizar una configuración del sistema (admin)' })
  @ApiOkResponseData(UpsertSystemConfigDto)
  upsertConfig(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertSystemConfigDto,
  ) {
    return this.systemConfigService.upsert(key, dto.value, user.sub);
  }

  @Get('products')
  @ApiOperation({ summary: 'Listar todos los productos de la plataforma sin restricciones (admin)' })
  @ApiOkResponseData()
  findAllProducts(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAllAdmin(query);
  }
}
