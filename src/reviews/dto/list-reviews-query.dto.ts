import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListReviewsQueryDto {
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
  @IsIn(['createdAt_desc', 'createdAt_asc', 'rating_desc', 'rating_asc'])
  sort?: 'createdAt_desc' | 'createdAt_asc' | 'rating_desc' | 'rating_asc';

  @IsOptional()
  @IsIn(['BOOKING', 'CONSULTATION'])
  sourceType?: 'BOOKING' | 'CONSULTATION';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;
}
