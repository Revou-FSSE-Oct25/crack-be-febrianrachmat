import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin Dashboard')
@ApiBearerAuth('access-token')
@Controller('admin/dashboard')
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get admin dashboard overview analytics' })
  getOverview() {
    return this.adminDashboardService.getOverview();
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Get admin analytics trends and breakdowns (7–90 days)',
  })
  getAnalytics(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminDashboardService.getAnalytics(query.days);
  }
}
