import { Type } from 'class-transformer';
import { ConsultationStatus } from '@prisma/client';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListConversationsQueryDto {
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
  @IsIn(['updatedAt_desc', 'updatedAt_asc', 'createdAt_desc', 'createdAt_asc'])
  sort?: 'updatedAt_desc' | 'updatedAt_asc' | 'createdAt_desc' | 'createdAt_asc';

  @IsOptional()
  @IsIn([
    ConsultationStatus.REQUESTED,
    ConsultationStatus.ACCEPTED,
    ConsultationStatus.IN_PROGRESS,
    ConsultationStatus.COMPLETED,
    ConsultationStatus.CANCELLED,
  ])
  consultationStatus?: ConsultationStatus;
}
