import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOperationsService } from './admin-operations.service';
import { AdminOperationsBookingsQueryDto } from './dto/admin-operations-bookings-query.dto';
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

  @Get('bookings')
  @ApiOperation({
    summary: 'List bookings for admin monitoring (enriched, filterable)',
  })
  listBookings(@Query() query: AdminOperationsBookingsQueryDto) {
    return this.adminOperationsService.listBookings(query);
  }
}
