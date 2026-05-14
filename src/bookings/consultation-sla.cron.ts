import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

/**
 * Phase 3: periodically scan active paid consultations and auto-refund when
 * the therapist never sent a chat message within the SLA window.
 *
 * Disabled when `CONSULTATION_SLA_CRON=false` (e.g. integration tests).
 */
@Injectable()
export class ConsultationSlaCronService {
  private readonly logger = new Logger(ConsultationSlaCronService.name);

  constructor(private readonly bookingsService: BookingsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSlaScan(): Promise<void> {
    if (process.env.CONSULTATION_SLA_CRON === 'false') {
      return;
    }
    try {
      const { checked, refunded } =
        await this.bookingsService.processConsultationSlaTimeouts();
      if (refunded > 0) {
        this.logger.log(
          `Consultation SLA scan: checked=${checked}, auto-refunded=${refunded}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Consultation SLA scan failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
