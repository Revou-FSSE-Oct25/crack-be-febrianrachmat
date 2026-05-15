import { PaymentMethod } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/**
 * A transaction is created for EITHER an in-person Booking OR an online
 * Consultation. The patient submits exactly one of `bookingId` or
 * `consultationId`. **Amount is always taken from the server:** booking
 * `visitFeeSnapshot` or consultation `feeSnapshot` — never from the client.
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

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
