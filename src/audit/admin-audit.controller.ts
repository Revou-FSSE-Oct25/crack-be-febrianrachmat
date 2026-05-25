import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('Admin Audit')
@ApiBearerAuth('access-token')
@Controller('admin/audit-logs')
@Roles(UserRole.ADMIN)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List persisted audit logs (admin)' })
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.listForAdmin(query);
  }
}
