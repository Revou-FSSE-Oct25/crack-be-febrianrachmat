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
      const isAdminPath = String(req.path ?? '').startsWith('/admin/');
      req.user = {
        sub: isAdminPath ? 'admin-user-1' : 'patient-user-1',
        email: isAdminPath ? 'admin@mail.com' : 'patient@mail.com',
        role: isAdminPath ? UserRole.ADMIN : UserRole.PATIENT,
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
    triggerAppointmentReminderScanByAdmin: jest.fn(),
    getLastAppointmentReminderScanStatus: jest.fn(),
    markTransactionPaidByAdmin: jest.fn(),
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

  it('GET /transactions returns role-filtered transaction list with pagination params', async () => {
    bookingsServiceMock.listTransactions.mockResolvedValue([
      {
        id: 'tx-1',
        status: 'PENDING',
      },
    ]);

    await request(app.getHttpServer())
      .get('/transactions?page=3&limit=2')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: 'tx-1',
            status: 'PENDING',
          },
        ]);
      });

    expect(bookingsServiceMock.listTransactions).toHaveBeenCalledWith(
      {
        sub: 'patient-user-1',
        email: 'patient@mail.com',
        role: UserRole.PATIENT,
      },
      {
        page: 3,
        limit: 2,
      },
    );
  });

  it('PATCH /bookings/:bookingId/status forwards user, bookingId, and status dto', async () => {
    bookingsServiceMock.updateBookingStatus.mockResolvedValue({
      id: 'booking-1',
      status: 'CANCELLED',
    });

    await request(app.getHttpServer())
      .patch('/bookings/booking-1/status')
      .send({ status: 'CANCELLED' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'booking-1',
          status: 'CANCELLED',
        });
      });

    expect(bookingsServiceMock.updateBookingStatus).toHaveBeenCalledWith(
      {
        sub: 'patient-user-1',
        email: 'patient@mail.com',
        role: UserRole.PATIENT,
      },
      'booking-1',
      { status: 'CANCELLED' },
    );
  });

  it('POST /admin/bookings/reminders/scan triggers manual reminder scan as admin', async () => {
    bookingsServiceMock.triggerAppointmentReminderScanByAdmin.mockResolvedValue({
      checked: 4,
      sent: 1,
      triggeredBy: 'admin-user-1',
      triggeredAt: '2099-01-01T00:00:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/admin/bookings/reminders/scan')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          checked: 4,
          sent: 1,
          triggeredBy: 'admin-user-1',
          triggeredAt: '2099-01-01T00:00:00.000Z',
        });
      });

    expect(
      bookingsServiceMock.triggerAppointmentReminderScanByAdmin,
    ).toHaveBeenCalledWith({
      sub: 'admin-user-1',
      email: 'admin@mail.com',
      role: UserRole.ADMIN,
    });
  });

  it('GET /admin/bookings/reminders/last-scan returns latest manual scan payload', async () => {
    bookingsServiceMock.getLastAppointmentReminderScanStatus.mockResolvedValue({
      found: true,
      lastScan: {
        checked: 4,
        sent: 1,
        triggeredBy: 'admin-user-1',
        triggeredAt: '2099-01-01T00:00:00.000Z',
      },
    });

    await request(app.getHttpServer())
      .get('/admin/bookings/reminders/last-scan')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          found: true,
          lastScan: {
            checked: 4,
            sent: 1,
            triggeredBy: 'admin-user-1',
            triggeredAt: '2099-01-01T00:00:00.000Z',
          },
        });
      });

    expect(
      bookingsServiceMock.getLastAppointmentReminderScanStatus,
    ).toHaveBeenCalled();
  });
});
