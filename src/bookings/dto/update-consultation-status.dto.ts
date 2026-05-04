import { ConsultationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateConsultationStatusDto {
  @IsEnum(ConsultationStatus)
  status!: ConsultationStatus;
}
