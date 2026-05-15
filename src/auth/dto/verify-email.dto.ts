import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Raw token from verification email link' })
  @IsString()
  @MinLength(32)
  token!: string;
}
