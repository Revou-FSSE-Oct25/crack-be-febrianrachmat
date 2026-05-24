import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

/**
 * Sends H-1 (default 24h) in-app reminders for confirmed visits.
 *
 * Disabled when `APPOINTMENT_REMINDER_CRON=false` (e.g. integration tests).
 */
@Injectable()
export class AppointmentReminderCronService {
  private readonly logger = new Logger(AppointmentReminderCronService.name);

  constructor(private readonly bookingsService: BookingsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleReminderScan(): Promise<void> {
    if (process.env.APPOINTMENT_REMINDER_CRON === 'false') {
      return;
    }
    try {
      const { checked, sent } =
        await this.bookingsService.processAppointmentReminders();
      if (sent > 0) {
        this.logger.log(
          `Appointment reminder scan: checked=${checked}, sent=${sent}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Appointment reminder scan failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
