import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class RescheduleBookingDto {
  @ApiPropertyOptional({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'Optional availability slot id to rebind booking schedule',
  })
  @IsOptional()
  @IsUUID()
  slotId?: string;

  @ApiPropertyOptional({
    example: '2026-05-15T09:00:00.000Z',
    description: 'Required when slotId is omitted; ignored when slotId is present',
  })
  @ValidateIf((o: RescheduleBookingDto) => !o.slotId)
  @IsDateString()
  appointmentDate?: string;
}
