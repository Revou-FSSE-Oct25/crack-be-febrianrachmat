import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async markAsRead(authUser: AuthUser, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== authUser.sub) {
      throw new NotFoundException('Notification not found.');
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

  async sendToUser(userId: string, dto: CreateNotificationDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Target user does not exist.');
    }

    return this.prisma.notification.create({
      data: {
        userId,
        title: dto.title,
        body: dto.body,
      },
    });
  }

  async broadcastToAllUsers(dto: CreateNotificationDto) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) {
      return { message: 'No active users found.', createdCount: 0 };
    }

    const result = await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: dto.title,
        body: dto.body,
      })),
    });

    return {
      message: 'Broadcast notification sent.',
      createdCount: result.count,
    };
  }
}
