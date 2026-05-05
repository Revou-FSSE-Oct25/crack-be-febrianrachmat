import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CreateAvailabilitySlotDto {
  @ApiProperty({
    example: '2026-05-15',
    description: 'Calendar date (must match start/end day in UTC)',
  })
  @IsDateString()
  slotDate!: string;

  @ApiProperty({ example: '2026-05-15T02:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-05-15T03:00:00.000Z' })
  @IsDateString()
  endTime!: string;
}
