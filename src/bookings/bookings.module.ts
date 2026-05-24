import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { AppointmentReminderCronService } from './appointment-reminder.cron';
import { ConsultationSlaCronService } from './consultation-sla.cron';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    ConsultationSlaCronService,
    AppointmentReminderCronService,
  ],
})
export class BookingsModule {}
