import { IsString, MinLength } from 'class-validator';

export class RefundTransactionDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
