import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateAvailabilitySlotDto {
  @ApiPropertyOptional({
    example: '2026-05-15',
    description: 'If set, must match start/end calendar day (UTC)',
  })
  @IsOptional()
  @IsDateString()
  slotDate?: string;

  @ApiPropertyOptional({ example: '2026-05-15T02:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-05-15T03:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Manually mark slot free/busy (blocked if active booking exists)',
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
