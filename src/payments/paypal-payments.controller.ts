import { Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import {
  ApiCommonErrorResponses,
  ApiCreatedResponseData,
  ApiOkResponseData,
  CurrentUser,
  Roles,
} from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { PaypalPaymentsService } from './paypal-payments.service';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@ApiCommonErrorResponses()
@Roles(UserRole.CUSTOMER)
@Controller('payments/paypal')
export class PaypalPaymentsController {
  constructor(private readonly paypalPaymentsService: PaypalPaymentsService) {}

  @Post('orders')
  // Cada llamada golpea la API de PayPal (OAuth + create order) — límite
  // propio para no dejar que alguien la use para tumbar la cuenta de PayPal
  // a fuerza de crear órdenes que nunca aprueba.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Crear una orden de PayPal a partir del carrito actual (comprador)' })
  @ApiCreatedResponseData()
  createOrder(@CurrentUser() user: JwtPayload) {
    return this.paypalPaymentsService.createCheckoutOrder(user.sub);
  }

  @Post('orders/:paypalOrderId/capture')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Capturar el pago aprobado en PayPal y generar la(s) solicitud(es) de compra (comprador)',
  })
  @ApiOkResponseData()
  captureOrder(@CurrentUser() user: JwtPayload, @Param('paypalOrderId') paypalOrderId: string) {
    return this.paypalPaymentsService.captureCheckoutOrder(user.sub, paypalOrderId);
  }
}
