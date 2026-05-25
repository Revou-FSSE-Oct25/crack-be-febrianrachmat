import { Injectable, Logger } from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

export type AuditRecordInput = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actor?: Pick<AuthUser, 'sub' | 'role'> | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an audit row. Failures are logged and swallowed so business
   * operations are not blocked by audit writes.
   */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          actorUserId: input.actor?.sub ?? null,
          actorRole: input.actor?.role ?? null,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Audit log write failed (${input.action} / ${input.entityId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async listForAdmin(query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }
}
