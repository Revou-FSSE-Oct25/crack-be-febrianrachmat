import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminOperationsTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
