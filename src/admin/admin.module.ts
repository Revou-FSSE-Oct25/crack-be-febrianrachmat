import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';

@Module({
  controllers: [AdminDashboardController, AdminOperationsController],
  providers: [AdminDashboardService, AdminOperationsService],
})
export class AdminModule {}
