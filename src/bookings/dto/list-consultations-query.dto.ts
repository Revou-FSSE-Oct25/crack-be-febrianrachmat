import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ConsultationStatus } from '@prisma/client';

export class ListConsultationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsIn(['createdAt_desc', 'createdAt_asc'])
  sort?: 'createdAt_desc' | 'createdAt_asc';

  @IsOptional()
  @IsIn([
    ConsultationStatus.REQUESTED,
    ConsultationStatus.ACCEPTED,
    ConsultationStatus.IN_PROGRESS,
    ConsultationStatus.COMPLETED,
    ConsultationStatus.CANCELLED,
  ])
  status?: ConsultationStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
