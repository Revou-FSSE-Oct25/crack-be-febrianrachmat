import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  bookingId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
