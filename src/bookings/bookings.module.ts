import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ConsultationSlaCronService } from './consultation-sla.cron';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, ConsultationSlaCronService],
})
export class BookingsModule {}
