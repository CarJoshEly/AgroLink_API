import { Module } from '@nestjs/common';
import { ProductsModule } from '../products';
import { FinanceModule } from '../finance';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';
import { SystemConfigService } from './system-config.service';

@Module({
  imports: [ProductsModule, FinanceModule],
  controllers: [AdminController],
  providers: [AdminStatsService, SystemConfigService],
})
export class AdminModule {}
