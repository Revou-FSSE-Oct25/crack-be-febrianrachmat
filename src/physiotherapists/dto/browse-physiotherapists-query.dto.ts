import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BROWSE_SORT_VALUES } from '../browse.helpers';

export class BrowsePhysiotherapistsQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /**
   * When true, only therapists whose `onlineUntil` is in the future are
   * returned (heartbeat from POST /physiotherapists/me/online).
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return Boolean(value);
  })
  @IsBoolean()
  onlineNow?: boolean;

  /** Minimum average star rating (1–5) from visible reviews. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minExperienceYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minVisitFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxVisitFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minConsultationFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxConsultationFee?: number;

  /** UTC day-of-week for availability slot: 0=Sunday ... 6=Saturday */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  availableDay?: number;

  /** UTC hour for availability slot startTime: 0..23 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  availableHour?: number;

  @IsOptional()
  @IsIn([...BROWSE_SORT_VALUES])
  sort?: (typeof BROWSE_SORT_VALUES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
