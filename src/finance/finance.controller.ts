import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../common/decorators';
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
@ApiBearerAuth('access-token')
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
  listActivePaymentMethods() {
    return this.paymentMethodsService.listActive();
  }

  @Get('payment-methods/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos los métodos de pago (admin)' })
  listAllPaymentMethods() {
    return this.paymentMethodsService.listAll();
  }

  @Post('payment-methods')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un método de pago (admin)' })
  createPaymentMethod(@Body() dto: CreatePaymentMethodDto, @CurrentUser() user: JwtPayload) {
    return this.paymentMethodsService.create(dto, user.sub);
  }

  @Patch('payment-methods/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar un método de pago (admin)' })
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
  getCurrentCommission() {
    return this.commissionConfigService.getCurrent();
  }

  @Get('commission-config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ver el historial de configuraciones de comisión (admin)' })
  listCommissionHistory(@Query() query: PaginationDto) {
    return this.commissionConfigService.listHistory(query);
  }

  @Post('commission-config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Configurar una nueva comisión (admin)' })
  createCommissionConfig(@CurrentUser() user: JwtPayload, @Body() dto: CreateCommissionConfigDto) {
    return this.commissionConfigService.create(user.sub, dto);
  }

  // ---- Transacciones ----

  @Get('transactions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todas las transacciones de la plataforma (admin)' })
  findAllTransactions(@Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('transactions/mine')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Ver mi historial financiero (vendedor)' })
  findMyTransactions(@CurrentUser() user: JwtPayload, @Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findMine(user.sub, query);
  }

  // ---- Dashboard financiero ----

  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Dashboard financiero de la plataforma (admin)' })
  getAdminDashboard() {
    return this.transactionsService.getAdminDashboard();
  }

  @Get('dashboard/mine')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Dashboard financiero del vendedor' })
  getSellerDashboard(@CurrentUser() user: JwtPayload) {
    return this.transactionsService.getSellerDashboard(user.sub);
  }

  @Get('transactions/:id')
  @Roles(UserRole.ADMIN, UserRole.SELLER, UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Ver el detalle de una transacción' })
  findTransactionById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.transactionsService.findById(id, { userId: user.sub, role: user.role as UserRole });
  }

  @Patch('transactions/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar el estado de una transacción (admin)' })
  updateTransactionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transactionsService.updateStatus(id, dto, user.sub);
  }
}
