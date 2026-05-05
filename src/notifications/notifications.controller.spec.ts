import { UserRole } from '@prisma/client';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const notificationsServiceMock = {
    listMyNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    sendToUser: jest.fn(),
    broadcastToAllUsers: jest.fn(),
  };

  const controller = new NotificationsController(
    notificationsServiceMock as never,
  );
  const PATIENT_USER = {
    sub: 'user-1',
    email: 'u@mail.com',
    role: UserRole.PATIENT,
  };
  const REQ = { user: PATIENT_USER };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates listMyNotifications with req.user and query', async () => {
    const query = { page: 2, limit: 5 };
    notificationsServiceMock.listMyNotifications.mockResolvedValue([
      { id: 'n1' },
    ]);

    await controller.listMyNotifications(REQ as never, query);

    expect(notificationsServiceMock.listMyNotifications).toHaveBeenCalledWith(
      PATIENT_USER,
      query,
    );
  });

  it('delegates markAsRead with req.user and notificationId', async () => {
    notificationsServiceMock.markAsRead.mockResolvedValue({ id: 'n1' });

    await controller.markAsRead(REQ as never, 'n1');

    expect(notificationsServiceMock.markAsRead).toHaveBeenCalledWith(
      PATIENT_USER,
      'n1',
    );
  });

  it('delegates markAllAsRead with req.user', async () => {
    notificationsServiceMock.markAllAsRead.mockResolvedValue({ updatedCount: 3 });

    await controller.markAllAsRead(REQ as never);

    expect(notificationsServiceMock.markAllAsRead).toHaveBeenCalledWith(
      PATIENT_USER,
    );
  });

  it('delegates sendToUser with userId and dto', async () => {
    const dto = { title: 'Info', body: 'Body' };
    notificationsServiceMock.sendToUser.mockResolvedValue({ id: 'n1' });

    await controller.sendToUser('user-2', dto);

    expect(notificationsServiceMock.sendToUser).toHaveBeenCalledWith(
      'user-2',
      dto,
    );
  });

  it('delegates broadcastToAll with dto', async () => {
    const dto = { title: 'Promo', body: 'Diskon' };
    notificationsServiceMock.broadcastToAllUsers.mockResolvedValue({
      createdCount: 2,
    });

    await controller.broadcastToAll(dto);

    expect(notificationsServiceMock.broadcastToAllUsers).toHaveBeenCalledWith(
      dto,
    );
  });
});
