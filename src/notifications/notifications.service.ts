import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  badRequestBusinessError,
  notFoundBusinessError,
} from '../common/errors/business-error';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { EmailMockService } from './email-mock.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailMock: EmailMockService,
    private readonly auditService: AuditService,
  ) {}

  async listMyNotifications(authUser: AuthUser, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId: authUser.sub },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId: authUser.sub } }),
    ]);

    return {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      items,
    };
  }

  async getUnreadCount(authUser: AuthUser) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId: authUser.sub, isRead: false },
    });

    return { unreadCount };
  }

  async markAsRead(authUser: AuthUser, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== authUser.sub) {
      throw notFoundBusinessError(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found.',
      );
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(authUser: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: authUser.sub, isRead: false },
      data: { isRead: true },
    });

    return {
      message: 'All notifications marked as read.',
      updatedCount: result.count,
    };
  }

  async sendToUser(
    actor: AuthUser,
    userId: string,
    dto: CreateNotificationDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw badRequestBusinessError(
        'TARGET_USER_NOT_FOUND',
        'Target user does not exist.',
      );
    }

    const notification = await this.dispatchNotification(
      userId,
      dto.title,
      dto.body,
    );

    await this.auditService.record({
      action: AuditAction.NOTIFICATION_SEND_USER,
      entityType: AuditEntityType.USER,
      entityId: userId,
      actor,
      metadata: { title: dto.title, notificationId: notification.id },
    });

    return notification;
  }

  async createSystemNotification(userId: string, title: string, body: string) {
    return this.dispatchNotification(userId, title, body);
  }

  async broadcastToAllUsers(actor: AuthUser, dto: CreateNotificationDto) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) {
      return { message: 'No active users found.', createdCount: 0 };
    }

    const notifications = await Promise.all(
      users.map((user) =>
        this.dispatchNotification(user.id, dto.title, dto.body),
      ),
    );

    await this.auditService.record({
      action: AuditAction.NOTIFICATION_BROADCAST,
      entityType: AuditEntityType.USER,
      entityId: 'broadcast',
      actor,
      metadata: {
        title: dto.title,
        createdCount: notifications.length,
      },
    });

    return {
      message: 'Broadcast notification sent.',
      createdCount: notifications.length,
    };
  }

  private async dispatchNotification(
    userId: string,
    title: string,
    body: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
      },
    });

    await this.emailMock
      .sendNotificationEmail({
        userId,
        title,
        body,
        notificationId: notification.id,
      })
      .catch(() => {
        // Email mock must not break in-app notifications.
      });

    return notification;
  }
}
