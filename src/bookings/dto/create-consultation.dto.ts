import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateConsultationDto {
  @IsUUID()
  physiotherapistId!: string;

  @IsString()
  @MinLength(10)
  complaint!: string;
}
