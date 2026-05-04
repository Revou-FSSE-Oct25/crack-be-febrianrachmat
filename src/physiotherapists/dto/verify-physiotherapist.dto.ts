import { TherapistVerificationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyPhysiotherapistDto {
  @IsEnum(TherapistVerificationStatus)
  status!: TherapistVerificationStatus;

  @IsOptional()
  @IsString()
  @MinLength(5)
  rejectionReason?: string;
}
