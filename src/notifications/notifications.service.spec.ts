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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists current user notifications with pagination', async () => {
    prismaMock.$transaction.mockResolvedValue([[{ id: 'n1' }], 11]);

    const result = await service.listMyNotifications(
      { sub: 'user-1', email: 'u@mail.com', role: UserRole.PATIENT },
      { page: 2, limit: 5 },
    );

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

    const result = await service.markAsRead(
      { sub: 'user-1', email: 'u@mail.com', role: UserRole.PATIENT },
      'n1',
    );

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
      service.markAsRead(
        { sub: 'user-1', email: 'u@mail.com', role: UserRole.PATIENT },
        'n1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

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
});
