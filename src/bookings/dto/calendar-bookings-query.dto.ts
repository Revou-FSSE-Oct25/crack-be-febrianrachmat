import { IsDateString } from 'class-validator';

export class CalendarBookingsQueryDto {
  /** Inclusive range start (ISO 8601). */
  @IsDateString()
  from!: string;

  /** Inclusive range end (ISO 8601). */
  @IsDateString()
  to!: string;
}
