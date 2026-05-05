import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAvailabilitySlotsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter slots with slotDate >= this date (ISO date or datetime)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter slots with slotDate <= this date (ISO date or datetime)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
