import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('Notifications read flow (e2e-lite)', () => {
  let app: INestApplication;
  class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'user-1',
        email: 'u@mail.com',
        role: UserRole.PATIENT,
      };
      return true;
    }
  }

  const notificationsServiceMock = {
    listMyNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    sendToUser: jest.fn(),
    broadcastToAllUsers: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalGuards(new MockAuthGuard());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /notifications/me returns current user notifications', async () => {
    notificationsServiceMock.listMyNotifications.mockResolvedValue({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      items: [{ id: 'n1', title: 'Info' }],
    });

    await request(app.getHttpServer())
      .get('/notifications/me?page=1&limit=10')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          items: [{ id: 'n1', title: 'Info' }],
        });
      });
  });

  it('PATCH /notifications/read-all marks all current user notifications as read', async () => {
    notificationsServiceMock.markAllAsRead.mockResolvedValue({
      message: 'All notifications marked as read.',
      updatedCount: 3,
    });

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          message: 'All notifications marked as read.',
          updatedCount: 3,
        });
      });
  });
});
