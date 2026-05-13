import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

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
