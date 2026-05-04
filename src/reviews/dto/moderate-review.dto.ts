import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ModerateReviewDto {
  @Type(() => Boolean)
  @IsBoolean()
  isHidden!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  moderationNote?: string;
}
