import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipEnvelope } from '../common/decorators/skip-envelope.decorator';
import { CSV_UTF8_BOM } from '../common/csv/csv.util';
import { AdminOperationsService } from './admin-operations.service';
import { AdminOperationsBookingsExportQueryDto } from './dto/admin-operations-bookings-export-query.dto';
import { AdminOperationsBookingsQueryDto } from './dto/admin-operations-bookings-query.dto';
import { AdminOperationsTransactionsExportQueryDto } from './dto/admin-operations-transactions-export-query.dto';
import { AdminOperationsTransactionsQueryDto } from './dto/admin-operations-transactions-query.dto';

@ApiTags('Admin Operations')
@ApiBearerAuth('access-token')
@Controller('admin/operations')
@Roles(UserRole.ADMIN)
export class AdminOperationsController {
  constructor(private readonly adminOperationsService: AdminOperationsService) {}

  @Get('queue')
  @ApiOperation({
    summary: 'Operational work queue counts and recent pending payments',
  })
  getQueue() {
    return this.adminOperationsService.getQueue();
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'List transactions for admin operations (enriched, filterable)',
  })
  listTransactions(@Query() query: AdminOperationsTransactionsQueryDto) {
    return this.adminOperationsService.listTransactions(query);
  }

  @SkipEnvelope()
  @Get('transactions/export')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Download transactions as CSV (max 10k rows, same filters as list)',
  })
  async exportTransactions(
    @Query() query: AdminOperationsTransactionsExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { csv, filename } =
      await this.adminOperationsService.exportTransactionsCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(CSV_UTF8_BOM + csv);
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'List bookings for admin monitoring (enriched, filterable)',
  })
  listBookings(@Query() query: AdminOperationsBookingsQueryDto) {
    return this.adminOperationsService.listBookings(query);
  }

  @SkipEnvelope()
  @Get('bookings/export')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Download bookings as CSV (max 10k rows, same filters as list)',
  })
  async exportBookings(
    @Query() query: AdminOperationsBookingsExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { csv, filename } =
      await this.adminOperationsService.exportBookingsCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(CSV_UTF8_BOM + csv);
  }
}
