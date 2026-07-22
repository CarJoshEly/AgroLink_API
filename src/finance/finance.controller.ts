import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { PaginationDto } from '../common/dto';
import type { JwtPayload } from '../common/interfaces';
import { PaymentMethodsService } from './payment-methods.service';
import { CommissionConfigService } from './commission-config.service';
import { TransactionsService } from './transactions.service';
import {
  CreateCommissionConfigDto,
  CreatePaymentMethodDto,
  ListTransactionsQueryDto,
  UpdatePaymentMethodDto,
  UpdateTransactionStatusDto,
} from './dto';

@ApiTags('Finance')
@ApiCommonErrorResponses()
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly commissionConfigService: CommissionConfigService,
    private readonly transactionsService: TransactionsService,
  ) {}

  // ---- Métodos de pago ----

  @Get('payment-methods')
  @Public()
  @ApiOperation({ summary: 'Listar métodos de pago disponibles' })
  @ApiOkResponseData()
  listActivePaymentMethods() {
    return this.paymentMethodsService.listActive();
  }

  @Get('payment-methods/all')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar todos los métodos de pago (admin)' })
  @ApiOkResponseData()
  listAllPaymentMethods() {
    return this.paymentMethodsService.listAll();
  }

  @Post('payment-methods')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear un método de pago (admin)' })
  @ApiCreatedResponseData(CreatePaymentMethodDto)
  createPaymentMethod(@Body() dto: CreatePaymentMethodDto, @CurrentUser() user: JwtPayload) {
    return this.paymentMethodsService.create(dto, user.sub);
  }

  @Patch('payment-methods/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar un método de pago (admin)' })
  @ApiOkResponseData(UpdatePaymentMethodDto)
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentMethodsService.update(id, dto, user.sub);
  }

  // ---- Configuración de comisiones ----

  @Get('commission-config/current')
  @Public()
  @ApiOperation({ summary: 'Ver la comisión vigente' })
  @ApiOkResponseData()
  getCurrentCommission() {
    return this.commissionConfigService.getCurrent();
  }

  @Get('commission-config')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ver el historial de configuraciones de comisión (admin)' })
  @ApiOkResponseData()
  listCommissionHistory(@Query() query: PaginationDto) {
    return this.commissionConfigService.listHistory(query);
  }

  @Post('commission-config')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Configurar una nueva comisión (admin)' })
  @ApiCreatedResponseData(CreateCommissionConfigDto)
  createCommissionConfig(@CurrentUser() user: JwtPayload, @Body() dto: CreateCommissionConfigDto) {
    return this.commissionConfigService.create(user.sub, dto);
  }

  // ---- Transacciones ----

  @Get('transactions')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar todas las transacciones de la plataforma (admin)' })
  @ApiOkResponseData()
  findAllTransactions(@Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('transactions/mine')
  @Roles(UserRole.SELLER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ver mi historial financiero (vendedor)' })
  @ApiOkResponseData()
  findMyTransactions(@CurrentUser() user: JwtPayload, @Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findMine(user.sub, query);
  }

  // ---- Dashboard financiero ----

  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dashboard financiero de la plataforma (admin)' })
  @ApiOkResponseData()
  getAdminDashboard() {
    return this.transactionsService.getAdminDashboard();
  }

  @Get('dashboard/mine')
  @Roles(UserRole.SELLER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dashboard financiero del vendedor' })
  @ApiOkResponseData()
  getSellerDashboard(@CurrentUser() user: JwtPayload) {
    return this.transactionsService.getSellerDashboard(user.sub);
  }

  @Get('transactions/:id')
  @Roles(UserRole.ADMIN, UserRole.SELLER, UserRole.CUSTOMER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ver el detalle de una transacción' })
  @ApiOkResponseData()
  findTransactionById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.transactionsService.findById(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Patch('transactions/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar el estado de una transacción (admin)' })
  @ApiOkResponseData(UpdateTransactionStatusDto)
  updateTransactionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transactionsService.updateStatus(id, dto, user.sub);
  }
}
