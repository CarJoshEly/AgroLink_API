import { Module } from '@nestjs/common';
import { CartModule } from '../cart';
import { OrdersModule } from '../orders';
import { FinanceModule } from '../finance';
import { PaypalClientService } from './paypal-client.service';
import { PaypalPaymentsService } from './paypal-payments.service';
import { PaypalPaymentsController } from './paypal-payments.controller';
import { PaypalReturnController } from './paypal-return.controller';

@Module({
  imports: [CartModule, OrdersModule, FinanceModule],
  controllers: [PaypalPaymentsController, PaypalReturnController],
  providers: [PaypalClientService, PaypalPaymentsService],
})
export class PaymentsModule {}
