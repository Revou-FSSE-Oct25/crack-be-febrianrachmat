import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('notifications/me')
  @ApiOperation({ summary: 'List notifications for current user' })
  listMyNotifications(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.notificationsService.listMyNotifications(
      req.user as AuthUser,
      query,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('notifications/me/unread-count')
  @ApiOperation({ summary: 'Unread in-app notification count for navbar badge' })
  getUnreadCount(@Req() req: Request) {
    return this.notificationsService.getUnreadCount(req.user as AuthUser);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Patch('notifications/:notificationId/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markAsRead(
    @Req() req: Request,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      req.user as AuthUser,
      notificationId,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  markAllAsRead(@Req() req: Request) {
    return this.notificationsService.markAllAsRead(req.user as AuthUser);
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/notifications/users/:userId')
  @ApiOperation({ summary: 'Send notification to one user (admin)' })
  sendToUser(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationsService.sendToUser(
      req.user as AuthUser,
      userId,
      dto,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/notifications/broadcast')
  @ApiOperation({ summary: 'Broadcast notification to all active users (admin)' })
  broadcastToAll(@Req() req: Request, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.broadcastToAllUsers(
      req.user as AuthUser,
      dto,
    );
  }
}
