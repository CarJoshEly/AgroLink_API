import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { UsersController } from './users.controller';
import { AdminSellersController } from './admin-sellers.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, AdminSellersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
