import { IsString, MinLength } from 'class-validator';

export class DeactivateAccountDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;
}
