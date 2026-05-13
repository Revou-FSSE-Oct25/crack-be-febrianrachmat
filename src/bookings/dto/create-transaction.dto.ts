import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * A transaction is created for EITHER an in-person Booking OR an online
 * Consultation. The patient submits exactly one of `bookingId` or
 * `consultationId`; the service layer enforces the XOR rule and that the
 * referenced entity is owned by the requesting patient.
 */
export class CreateTransactionDto {
  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => !o.consultationId)
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @ValidateIf((o: CreateTransactionDto) => !o.bookingId)
  @IsUUID()
  consultationId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
