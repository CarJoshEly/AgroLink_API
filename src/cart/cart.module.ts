import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [OrdersModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
