import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { CommissionConfigService } from './commission-config.service';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [FinanceController],
  providers: [PaymentMethodsService, CommissionConfigService, TransactionsService],
  exports: [TransactionsService],
})
export class FinanceModule {}
