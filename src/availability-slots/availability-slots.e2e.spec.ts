import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilitySlotsService } from './availability-slots.service';

describe('Availability slots public listing (e2e-lite)', () => {
  let app: INestApplication;
  class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'patient-user-1',
        email: 'patient@mail.com',
        role: UserRole.PATIENT,
      };
      return true;
    }
  }

  const availabilitySlotsServiceMock = {
    createMine: jest.fn(),
    listMine: jest.fn(),
    updateMine: jest.fn(),
    removeMine: jest.fn(),
    listForTherapistProfile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AvailabilitySlotsController],
      providers: [
        {
          provide: AvailabilitySlotsService,
          useValue: availabilitySlotsServiceMock,
        },
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

  it('GET /physiotherapists/:profileId/availability-slots returns paginated available slots', async () => {
    const profileId = '11111111-1111-1111-1111-111111111111';
    availabilitySlotsServiceMock.listForTherapistProfile.mockResolvedValue({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      items: [
        {
          id: 'slot-1',
          physiotherapistId: profileId,
          slotDate: '2099-06-01T00:00:00.000Z',
          startTime: '2099-06-01T09:00:00.000Z',
          endTime: '2099-06-01T10:00:00.000Z',
          isAvailable: true,
        },
      ],
    });

    await request(app.getHttpServer())
      .get(
        `/physiotherapists/${profileId}/availability-slots?page=1&limit=10&from=2099-06-01`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          items: [
            {
              id: 'slot-1',
              physiotherapistId: profileId,
              slotDate: '2099-06-01T00:00:00.000Z',
              startTime: '2099-06-01T09:00:00.000Z',
              endTime: '2099-06-01T10:00:00.000Z',
              isAvailable: true,
            },
          ],
        });
      });

    expect(
      availabilitySlotsServiceMock.listForTherapistProfile,
    ).toHaveBeenCalledWith(profileId, {
      page: 1,
      limit: 10,
      from: '2099-06-01',
    });
  });
});
