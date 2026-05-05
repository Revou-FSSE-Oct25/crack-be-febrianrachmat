import { AppointmentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsUUID()
  consultationId?: string;

  @IsUUID()
  physiotherapistId!: string;

  @IsOptional()
  @IsUUID()
  slotId?: string;

  @IsEnum(AppointmentType)
  appointmentType!: AppointmentType;

  @ValidateIf((o: CreateBookingDto) => !o.slotId)
  @IsNotEmpty()
  @IsDateString()
  @Type(() => String)
  appointmentDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  clinicAddress?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  homeVisitAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
