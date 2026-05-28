import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class ListBookingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsIn(['appointmentDate_desc', 'appointmentDate_asc', 'createdAt_desc', 'createdAt_asc'])
  sort?:
    | 'appointmentDate_desc'
    | 'appointmentDate_asc'
    | 'createdAt_desc'
    | 'createdAt_asc';

  @IsOptional()
  @IsIn([
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ])
  status?: BookingStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
