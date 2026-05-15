import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check (API and database connectivity)' })
  async checkHealth(): Promise<{ status: string; database: string }> {
    try {
      // Simple DB check: executes a lightweight raw query.
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch {
      // API is alive but database is unreachable.
      return {
        status: 'degraded',
        database: 'disconnected',
      };
    }
  }
}
