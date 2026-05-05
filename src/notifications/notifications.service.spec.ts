import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prismaMock = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new NotificationsService(prismaMock as never);
  const PATIENT_USER = {
    sub: 'user-1',
    email: 'u@mail.com',
    role: UserRole.PATIENT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // user notification read flows
  it('lists current user notifications with pagination', async () => {
    prismaMock.$transaction.mockResolvedValue([[{ id: 'n1' }], 11]);

    const result = await service.listMyNotifications(PATIENT_USER, {
      page: 2,
      limit: 5,
    });

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
      items: [{ id: 'n1' }],
    });
  });

  it('marks owned notification as read', async () => {
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'user-1',
      isRead: false,
    });
    prismaMock.notification.update.mockResolvedValue({
      id: 'n1',
      userId: 'user-1',
      isRead: true,
    });

    const result = await service.markAsRead(PATIENT_USER, 'n1');

    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { isRead: true },
    });
    expect(result).toEqual({
      id: 'n1',
      userId: 'user-1',
      isRead: true,
    });
  });

  it('rejects markAsRead when notification is not owned by current user', async () => {
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'n1',
      userId: 'other-user',
    });

    await expect(
      service.markAsRead(PATIENT_USER, 'n1'),
    ).rejects.toThrow(NotFoundException);
  });

  // admin send / broadcast flows
  it('sendToUser rejects when target user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.sendToUser('missing-user', {
        title: 'A',
        body: 'B',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('broadcastToAllUsers returns zero when no active users', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await service.broadcastToAllUsers({
      title: 'Info',
      body: 'Body',
    });

    expect(result).toEqual({
      message: 'No active users found.',
      createdCount: 0,
    });
  });

  it('broadcastToAllUsers creates notifications for all active users', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 2 });

    const result = await service.broadcastToAllUsers({
      title: 'Promo',
      body: 'Diskon',
    });

    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', title: 'Promo', body: 'Diskon' },
        { userId: 'u2', title: 'Promo', body: 'Diskon' },
      ],
    });
    expect(result).toEqual({
      message: 'Broadcast notification sent.',
      createdCount: 2,
    });
  });

  // helper methods
  it('markAllAsRead updates unread notifications and returns summary', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markAllAsRead(PATIENT_USER);

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
    expect(result).toEqual({
      message: 'All notifications marked as read.',
      updatedCount: 3,
    });
  });

  it('createSystemNotification creates direct notification payload', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'n-system-1',
      userId: 'user-1',
      title: 'System',
      body: 'Message',
    });

    const result = await service.createSystemNotification(
      'user-1',
      'System',
      'Message',
    );

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: 'System',
        body: 'Message',
      },
    });
    expect(result).toEqual({
      id: 'n-system-1',
      userId: 'user-1',
      title: 'System',
      body: 'Message',
    });
  });
});
