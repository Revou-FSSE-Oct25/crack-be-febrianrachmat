import { IsISO8601, IsOptional } from 'class-validator';

export class StreamMessagesQueryDto {
  /**
   * ISO timestamp of the newest message the client already has.
   * Server emits only messages with `createdAt` strictly after this value.
   */
  @IsOptional()
  @IsISO8601()
  since?: string;
}
