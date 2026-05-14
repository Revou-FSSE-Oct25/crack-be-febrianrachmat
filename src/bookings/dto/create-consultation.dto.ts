import { ConsultationSlaTier } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateConsultationDto {
  @IsUUID()
  physiotherapistId!: string;

  @IsString()
  @MinLength(10)
  complaint!: string;

  /**
   * STANDARD: first therapist chat reply expected within 24h (configurable).
   * FAST_ONLINE: 10 minutes — only allowed if the therapist is heartbeat-online
   * at creation time (`onlineUntil` in the future).
   */
  @IsOptional()
  @IsEnum(ConsultationSlaTier)
  slaTier?: ConsultationSlaTier;
}
