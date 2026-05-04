import { IsUUID } from 'class-validator';

export class CreateOrGetConversationDto {
  @IsUUID()
  consultationId!: string;
}
