import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

describe('Bookings listing (e2e-lite)', () => {
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

  const bookingsServiceMock = {
    createConsultation: jest.fn(),
    listMyConsultations: jest.fn(),
    updateConsultationStatus: jest.fn(),
    createBooking: jest.fn(),
    listMyBookings: jest.fn(),
    updateBookingStatus: jest.fn(),
    createTransaction: jest.fn(),
    markTransactionPaid: jest.fn(),
    refundTransactionByAdmin: jest.fn(),
    listTransactions: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: bookingsServiceMock }],
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

  it('GET /bookings/me returns role-filtered booking list with pagination params', async () => {
    bookingsServiceMock.listMyBookings.mockResolvedValue([
      {
        id: 'booking-1',
        status: 'PENDING',
      },
    ]);

    await request(app.getHttpServer())
      .get('/bookings/me?page=2&limit=5')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: 'booking-1',
            status: 'PENDING',
          },
        ]);
      });

    expect(bookingsServiceMock.listMyBookings).toHaveBeenCalledWith(
      {
        sub: 'patient-user-1',
        email: 'patient@mail.com',
        role: UserRole.PATIENT,
      },
      {
        page: 2,
        limit: 5,
      },
    );
  });

  it('GET /consultations/me returns role-filtered consultation list with pagination params', async () => {
    bookingsServiceMock.listMyConsultations.mockResolvedValue([
      {
        id: 'consultation-1',
        status: 'REQUESTED',
      },
    ]);

    await request(app.getHttpServer())
      .get('/consultations/me?page=1&limit=10')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: 'consultation-1',
            status: 'REQUESTED',
          },
        ]);
      });

    expect(bookingsServiceMock.listMyConsultations).toHaveBeenCalledWith(
      {
        sub: 'patient-user-1',
        email: 'patient@mail.com',
        role: UserRole.PATIENT,
      },
      {
        page: 1,
        limit: 10,
      },
    );
  });
});
