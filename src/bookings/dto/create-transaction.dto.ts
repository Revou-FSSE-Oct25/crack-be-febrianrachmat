import { PaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsUrl,
  IsUUID,
  ValidateIf,
} from 'class-validator';

function emptyToUndefined(v: unknown): unknown {
  return v === '' || v === null || v === undefined ? undefined : v;
}

/**
 * A transaction is created for EITHER an in-person Booking OR an online
 * Consultation. The patient submits exactly one of `bookingId` or
 * `consultationId`. **Amount is always taken from the server:** booking
 * `visitFeeSnapshot` or consultation `feeSnapshot` — never from the client.
 *
 * Bukti bayar: isi `paymentProofUrl` (https) **atau** upload field `proof` (multipart).
 */
export class CreateTransactionDto {
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((o: CreateTransactionDto) => !o.consultationId)
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((o: CreateTransactionDto) => !o.bookingId)
  @IsUUID()
  consultationId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUrl({ require_protocol: true, protocols: ['https'], require_tld: false })
  paymentProofUrl?: string;
}
