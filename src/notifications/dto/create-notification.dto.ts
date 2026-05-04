import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'Booking Updated' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'Your booking has been confirmed by physiotherapist.' })
  @IsString()
  @MinLength(3)
  body!: string;
}
