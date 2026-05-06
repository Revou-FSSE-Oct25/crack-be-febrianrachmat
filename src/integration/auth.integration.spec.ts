import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { TransformResponseInterceptor } from '../common/interceptors/transform-response.interceptor';
import { PrismaService } from '../prisma/prisma.service';

type AuthResponse = {
  success: boolean;
  data: {
    accessToken: string;
    user: {
      id: string;
      fullName: string;
      email: string;
      role: UserRole;
      isActive: boolean;
    };
  };
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

describe('Core integration (real DB, no service mocks)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function resetDatabase(): Promise<void> {
    // Truncate all app tables to keep integration tests deterministic.
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "Message",
        "ConversationParticipant",
        "Conversation",
        "Review",
        "Transaction",
        "Booking",
        "Consultation",
        "AvailabilitySlot",
        "Notification",
        "PhysiotherapistProfile",
        "PatientProfile",
        "Category",
        "User"
      RESTART IDENTITY CASCADE;
    `);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    const reflector = app.get(Reflector);
    app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));
    await app.init();

    prisma = app.get(PrismaService);
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await app.close();
  });

  it('register -> login -> me flow works end-to-end', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Integration Patient',
        email: 'integration-patient@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201);

    const registerBody = registerRes.body as AuthResponse;
    expect(registerBody.success).toBe(true);
    expect(registerBody.data.user.role).toBe(UserRole.PATIENT);
    expect(registerBody.data.accessToken).toBeTruthy();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'integration-patient@mail.com',
        password: 'password123',
      })
      .expect(201);

    const loginBody = loginRes.body as AuthResponse;
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.user.email).toBe('integration-patient@mail.com');
    expect(loginBody.data.accessToken).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginBody.data.accessToken}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data).toEqual(
      expect.objectContaining({
        email: 'integration-patient@mail.com',
        role: UserRole.PATIENT,
      }),
    );
  });

  it('patient can create consultation then booking with approved therapist', async () => {
    const patientRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Patient Integration',
        email: 'patient-flow@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201);

    const patientToken = (patientRegisterRes.body as AuthResponse).data.accessToken;

    const therapistRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Therapist Integration',
        email: 'therapist-flow@mail.com',
        password: 'password123',
        role: UserRole.PHYSIOTHERAPIST,
      })
      .expect(201);

    const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
    const therapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: therapistUserId },
    });
    expect(therapistProfile).toBeTruthy();

    await prisma.physiotherapistProfile.update({
      where: { id: therapistProfile!.id },
      data: {
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    const consultationRes = await request(app.getHttpServer())
      .post('/consultations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        physiotherapistId: therapistProfile!.id,
        complaint: 'Lower back pain for more than two weeks.',
      })
      .expect(201);

    const consultationBody = consultationRes.body as ApiEnvelope<{ id: string }>;
    expect(consultationBody.success).toBe(true);
    expect(consultationBody.data.id).toBeTruthy();

    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        consultationId: consultationBody.data.id,
        physiotherapistId: therapistProfile!.id,
        appointmentType: 'CLINIC_VISIT',
        appointmentDate: '2099-06-01T09:00:00.000Z',
        clinicAddress: 'Jl. Integrasi Klinik Utama 123',
        notes: 'Please focus on pain relief first.',
      })
      .expect(201);

    const bookingBody = bookingRes.body as ApiEnvelope<{
      id: string;
      consultationId: string | null;
      physiotherapistId: string;
      appointmentType: string;
    }>;
    expect(bookingBody.success).toBe(true);
    expect(bookingBody.data).toEqual(
      expect.objectContaining({
        consultationId: consultationBody.data.id,
        physiotherapistId: therapistProfile!.id,
        appointmentType: 'CLINIC_VISIT',
      }),
    );
  });

  it('booking transaction lifecycle works: create -> pay -> admin refund', async () => {
    const adminRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Bootstrap Admin',
        email: 'bootstrap-admin@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201);
    const adminUserId = (adminRegisterRes.body as AuthResponse).data.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: UserRole.ADMIN },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'bootstrap-admin@mail.com',
        password: 'password123',
      })
      .expect(201);
    const adminToken = (adminLoginRes.body as AuthResponse).data.accessToken;

    const patientRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Patient Tx',
        email: 'patient-tx@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201);
    const patientToken = (patientRegisterRes.body as AuthResponse).data.accessToken;

    const therapistRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Therapist Tx',
        email: 'therapist-tx@mail.com',
        password: 'password123',
        role: UserRole.PHYSIOTHERAPIST,
      })
      .expect(201);
    const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
    const therapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: therapistUserId },
    });
    expect(therapistProfile).toBeTruthy();

    await prisma.physiotherapistProfile.update({
      where: { id: therapistProfile!.id },
      data: {
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        physiotherapistId: therapistProfile!.id,
        appointmentType: 'CLINIC_VISIT',
        appointmentDate: '2099-07-01T09:00:00.000Z',
        clinicAddress: 'Jl. Integrasi Transaksi 123',
      })
      .expect(201);
    const bookingId = (bookingRes.body as ApiEnvelope<{ id: string }>).data.id;

    const transactionCreateRes = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        bookingId,
        amount: 250000,
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);
    const transactionId = (transactionCreateRes.body as ApiEnvelope<{ id: string }>).data.id;

    const payRes = await request(app.getHttpServer())
      .patch(`/transactions/${transactionId}/pay`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect((payRes.body as ApiEnvelope<{ status: string }>).data.status).toBe('PAID');

    const refundRes = await request(app.getHttpServer())
      .patch(`/admin/transactions/${transactionId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Integration refund test' })
      .expect(200);
    expect((refundRes.body as ApiEnvelope<{ status: string }>).data.status).toBe(
      'REFUNDED',
    );
  });

  it('cross-module flow works: slot booking -> chat -> payment -> notifications', async () => {
    const patientRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Patient Full Flow',
        email: 'patient-full-flow@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201);
    const patientToken = (patientRegisterRes.body as AuthResponse).data.accessToken;

    const therapistRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Therapist Full Flow',
        email: 'therapist-full-flow@mail.com',
        password: 'password123',
        role: UserRole.PHYSIOTHERAPIST,
      })
      .expect(201);
    const therapistToken = (therapistRegisterRes.body as AuthResponse).data.accessToken;
    const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
    const therapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: therapistUserId },
    });
    expect(therapistProfile).toBeTruthy();

    await prisma.physiotherapistProfile.update({
      where: { id: therapistProfile!.id },
      data: {
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    const slotRes = await request(app.getHttpServer())
      .post('/physiotherapists/me/availability-slots')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({
        slotDate: '2099-12-30',
        startTime: '2099-12-30T09:00:00.000Z',
        endTime: '2099-12-30T10:00:00.000Z',
      })
      .expect(201);
    const slotId = (slotRes.body as ApiEnvelope<{ id: string }>).data.id;

    const consultationRes = await request(app.getHttpServer())
      .post('/consultations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        physiotherapistId: therapistProfile!.id,
        complaint: 'Cross module integration flow test.',
      })
      .expect(201);
    const consultationId = (consultationRes.body as ApiEnvelope<{ id: string }>).data.id;

    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        consultationId,
        physiotherapistId: therapistProfile!.id,
        slotId,
        appointmentType: 'CLINIC_VISIT',
        clinicAddress: 'Jl. Integrasi Full Flow 123',
      })
      .expect(201);
    const booking = (bookingRes.body as ApiEnvelope<{
      id: string;
      slotId: string | null;
      appointmentDate: string;
    }>).data;
    expect(booking.slotId).toBe(slotId);
    expect(booking.appointmentDate).toBe('2099-12-30T09:00:00.000Z');

    const conversationRes = await request(app.getHttpServer())
      .post('/chat/conversations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ consultationId })
      .expect(201);
    const conversationId = (conversationRes.body as ApiEnvelope<{ id: string }>).data.id;

    await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ content: 'Hello therapist, please confirm my schedule.' })
      .expect(201);

    const therapistMessagesRes = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .expect(200);
    const therapistMessages = (therapistMessagesRes.body as ApiEnvelope<
      Array<{ content: string }>
    >).data;
    expect(therapistMessages.length).toBeGreaterThan(0);
    expect(therapistMessages[0].content).toContain('Hello therapist');

    const transactionRes = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        bookingId: booking.id,
        amount: 300000,
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);
    const transactionId = (transactionRes.body as ApiEnvelope<{ id: string }>).data.id;

    await request(app.getHttpServer())
      .patch(`/transactions/${transactionId}/pay`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const patientNotificationsRes = await request(app.getHttpServer())
      .get('/notifications/me')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    const patientNotifications = (patientNotificationsRes.body as ApiEnvelope<
      Array<{ title: string }>
    >).data;
    expect(
      patientNotifications.some((item) => item.title === 'Payment Successful'),
    ).toBe(true);

    const therapistNotificationsRes = await request(app.getHttpServer())
      .get('/notifications/me')
      .set('Authorization', `Bearer ${therapistToken}`)
      .expect(200);
    const therapistNotifications = (therapistNotificationsRes.body as ApiEnvelope<
      Array<{ title: string }>
    >).data;
    expect(
      therapistNotifications.some((item) => item.title === 'New Consultation Request'),
    ).toBe(true);
    expect(
      therapistNotifications.some((item) => item.title === 'New Booking Request'),
    ).toBe(true);
  });

  it('returns 403 when patient calls admin refund endpoint', async () => {
    const patientRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Patient Refund Denied',
        email: 'patient-refund-denied@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201);
    const patientToken = (patientRegisterRes.body as AuthResponse).data.accessToken;

    const therapistRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Therapist Refund Denied',
        email: 'therapist-refund-denied@mail.com',
        password: 'password123',
        role: UserRole.PHYSIOTHERAPIST,
      })
      .expect(201);
    const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
    const therapistProfile = await prisma.physiotherapistProfile.findUnique({
      where: { userId: therapistUserId },
    });
    expect(therapistProfile).toBeTruthy();

    await prisma.physiotherapistProfile.update({
      where: { id: therapistProfile!.id },
      data: {
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        physiotherapistId: therapistProfile!.id,
        appointmentType: 'CLINIC_VISIT',
        appointmentDate: '2099-08-01T09:00:00.000Z',
        clinicAddress: 'Jl. RBAC Refund Test',
      })
      .expect(201);
    const bookingId = (bookingRes.body as ApiEnvelope<{ id: string }>).data.id;

    const transactionCreateRes = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        bookingId,
        amount: 100000,
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);
    const transactionId = (transactionCreateRes.body as ApiEnvelope<{ id: string }>).data.id;

    await request(app.getHttpServer())
      .patch(`/transactions/${transactionId}/pay`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const forbiddenRes = await request(app.getHttpServer())
      .patch(`/admin/transactions/${transactionId}/refund`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'Should not be allowed' })
      .expect(403);

    expect(forbiddenRes.body.success).toBe(false);
    expect(forbiddenRes.body.error.code).toBe(403);
  });

  describe('RBAC negative paths', () => {
    it('returns 403 when physiotherapist creates a consultation', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist No Consult',
          email: 'therapist-no-consult@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const token = (registerRes.body as AuthResponse).data.accessToken;

      const res = await request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          physiotherapistId: '22222222-2222-4222-8222-222222222222',
          complaint: 'Should be rejected by RBAC before validation.',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
    });

    it('returns 403 when patient creates an availability slot', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient No Slots',
          email: 'patient-no-slots@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const token = (registerRes.body as AuthResponse).data.accessToken;

      const res = await request(app.getHttpServer())
        .post('/physiotherapists/me/availability-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          slotDate: '2099-12-01',
          startTime: '2099-12-01T09:00:00.000Z',
          endTime: '2099-12-01T10:00:00.000Z',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
    });

    it('returns 403 when patient opens admin dashboard overview', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient No Admin',
          email: 'patient-no-admin@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const token = (registerRes.body as AuthResponse).data.accessToken;

      const res = await request(app.getHttpServer())
        .get('/admin/dashboard/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
    });

    it('returns 403 when patient broadcasts an admin notification', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient No Broadcast',
          email: 'patient-no-broadcast@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const token = (registerRes.body as AuthResponse).data.accessToken;

      const res = await request(app.getHttpServer())
        .post('/admin/notifications/broadcast')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Should never send',
          body: 'Patient must not reach this handler.',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
    });

    it('returns 403 when physiotherapist marks a transaction as paid', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist No Pay',
          email: 'therapist-no-pay@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const token = (registerRes.body as AuthResponse).data.accessToken;

      const res = await request(app.getHttpServer())
        .patch(
          '/transactions/33333333-3333-4333-8333-333333333333/pay',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
    });
  });

  describe('Ownership negative paths', () => {
    it("returns 404 when patient A marks patient B's notification as read", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Owner A',
          email: 'patient-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Owner B',
          email: 'patient-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBUserId = (patientBRegisterRes.body as AuthResponse).data.user.id;

      const notification = await prisma.notification.create({
        data: {
          userId: patientBUserId,
          title: 'Private Notification',
          body: 'Only patient B can mark this as read.',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Notification not found.');
    });

    it("returns 403 when patient A updates patient B's booking status", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Booking Owner A',
          email: 'patient-booking-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Booking Owner B',
          email: 'patient-booking-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBToken = (patientBRegisterRes.body as AuthResponse).data.accessToken;

      const therapistRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Booking Owner',
          email: 'therapist-booking-owner@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
      const therapistProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistUserId },
      });
      expect(therapistProfile).toBeTruthy();

      await prisma.physiotherapistProfile.update({
        where: { id: therapistProfile!.id },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          physiotherapistId: therapistProfile!.id,
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: '2099-10-01T09:00:00.000Z',
          clinicAddress: 'Jl. Ownership Booking 123',
        })
        .expect(201);
      const bookingId = (bookingRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ status: 'CANCELLED' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe('You can only update your own bookings.');
    });

    it("returns 403 when patient A cancels patient B's consultation", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Consultation Owner A',
          email: 'patient-consultation-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Consultation Owner B',
          email: 'patient-consultation-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBToken = (patientBRegisterRes.body as AuthResponse).data.accessToken;

      const therapistRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Consultation Owner',
          email: 'therapist-consultation-owner@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
      const therapistProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistUserId },
      });
      expect(therapistProfile).toBeTruthy();

      await prisma.physiotherapistProfile.update({
        where: { id: therapistProfile!.id },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const consultationRes = await request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          physiotherapistId: therapistProfile!.id,
          complaint: 'Knee pain for ownership check.',
        })
        .expect(201);
      const consultationId = (consultationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .patch(`/consultations/${consultationId}/status`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ status: 'CANCELLED' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe(
        'You can only update your own consultations.',
      );
    });

    it("returns 404 when patient A pays patient B's transaction", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Transaction Owner A',
          email: 'patient-transaction-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Transaction Owner B',
          email: 'patient-transaction-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBToken = (patientBRegisterRes.body as AuthResponse).data.accessToken;

      const therapistRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Transaction Owner',
          email: 'therapist-transaction-owner@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
      const therapistProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistUserId },
      });
      expect(therapistProfile).toBeTruthy();

      await prisma.physiotherapistProfile.update({
        where: { id: therapistProfile!.id },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          physiotherapistId: therapistProfile!.id,
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: '2099-11-01T09:00:00.000Z',
          clinicAddress: 'Jl. Ownership Transaction 123',
        })
        .expect(201);
      const bookingId = (bookingRes.body as ApiEnvelope<{ id: string }>).data.id;

      const transactionRes = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          bookingId,
          amount: 150000,
          paymentMethod: 'BANK_TRANSFER',
        })
        .expect(201);
      const transactionId = (transactionRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .patch(`/transactions/${transactionId}/pay`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Transaction not found.');
    });

    it("returns 403 when therapist A updates therapist B's consultation", async () => {
      const patientRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Therapist Ownership',
          email: 'patient-therapist-ownership@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientToken = (patientRegisterRes.body as AuthResponse).data.accessToken;

      const therapistARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Owner A',
          email: 'therapist-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistAToken = (therapistARegisterRes.body as AuthResponse).data.accessToken;
      const therapistAUserId = (therapistARegisterRes.body as AuthResponse).data.user.id;

      const therapistBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Owner B',
          email: 'therapist-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistBUserId = (therapistBRegisterRes.body as AuthResponse).data.user.id;

      const therapistAProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistAUserId },
      });
      const therapistBProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistBUserId },
      });
      expect(therapistAProfile).toBeTruthy();
      expect(therapistBProfile).toBeTruthy();

      await prisma.physiotherapistProfile.updateMany({
        where: { id: { in: [therapistAProfile!.id, therapistBProfile!.id] } },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const consultationRes = await request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          physiotherapistId: therapistBProfile!.id,
          complaint: 'Should only be editable by therapist B.',
        })
        .expect(201);
      const consultationId = (consultationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .patch(`/consultations/${consultationId}/status`)
        .set('Authorization', `Bearer ${therapistAToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe('You can only update your own consultations.');
    });

    it("returns 403 when therapist A updates therapist B's booking", async () => {
      const patientRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Booking Therapist Ownership',
          email: 'patient-booking-therapist-ownership@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientToken = (patientRegisterRes.body as AuthResponse).data.accessToken;

      const therapistARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Booking Owner A',
          email: 'therapist-booking-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistAToken = (therapistARegisterRes.body as AuthResponse).data.accessToken;
      const therapistAUserId = (therapistARegisterRes.body as AuthResponse).data.user.id;

      const therapistBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Booking Owner B',
          email: 'therapist-booking-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistBUserId = (therapistBRegisterRes.body as AuthResponse).data.user.id;

      const therapistAProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistAUserId },
      });
      const therapistBProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistBUserId },
      });
      expect(therapistAProfile).toBeTruthy();
      expect(therapistBProfile).toBeTruthy();

      await prisma.physiotherapistProfile.updateMany({
        where: { id: { in: [therapistAProfile!.id, therapistBProfile!.id] } },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          physiotherapistId: therapistBProfile!.id,
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: '2099-12-01T09:00:00.000Z',
          clinicAddress: 'Jl. Therapist Ownership Booking',
        })
        .expect(201);
      const bookingId = (bookingRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${therapistAToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe('You can only update your own bookings.');
    });

    it("returns 404 when therapist A updates therapist B's availability slot", async () => {
      const therapistARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Slot Owner A',
          email: 'therapist-slot-owner-a@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistAToken = (therapistARegisterRes.body as AuthResponse).data.accessToken;

      const therapistBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Slot Owner B',
          email: 'therapist-slot-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistBToken = (therapistBRegisterRes.body as AuthResponse).data.accessToken;

      const slotRes = await request(app.getHttpServer())
        .post('/physiotherapists/me/availability-slots')
        .set('Authorization', `Bearer ${therapistBToken}`)
        .send({
          slotDate: '2099-12-20',
          startTime: '2099-12-20T09:00:00.000Z',
          endTime: '2099-12-20T10:00:00.000Z',
        })
        .expect(201);
      const slotId = (slotRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .patch(`/physiotherapists/me/availability-slots/${slotId}`)
        .set('Authorization', `Bearer ${therapistAToken}`)
        .send({ isAvailable: false })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Availability slot not found.');
    });

    it("returns 404 when therapist A deletes therapist B's availability slot", async () => {
      const therapistARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Slot Delete A',
          email: 'therapist-slot-delete-a@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistAToken = (therapistARegisterRes.body as AuthResponse).data.accessToken;

      const therapistBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Slot Delete B',
          email: 'therapist-slot-delete-b@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistBToken = (therapistBRegisterRes.body as AuthResponse).data.accessToken;

      const slotRes = await request(app.getHttpServer())
        .post('/physiotherapists/me/availability-slots')
        .set('Authorization', `Bearer ${therapistBToken}`)
        .send({
          slotDate: '2099-12-21',
          startTime: '2099-12-21T09:00:00.000Z',
          endTime: '2099-12-21T10:00:00.000Z',
        })
        .expect(201);
      const slotId = (slotRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .delete(`/physiotherapists/me/availability-slots/${slotId}`)
        .set('Authorization', `Bearer ${therapistAToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Availability slot not found.');
    });

    it("returns 403 when non-participant patient reads another user's conversation messages", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Chat Outsider A',
          email: 'patient-chat-outsider-a@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Chat Owner B',
          email: 'patient-chat-owner-b@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBToken = (patientBRegisterRes.body as AuthResponse).data.accessToken;

      const therapistRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Chat Owner',
          email: 'therapist-chat-owner@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
      const therapistProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistUserId },
      });
      expect(therapistProfile).toBeTruthy();

      await prisma.physiotherapistProfile.update({
        where: { id: therapistProfile!.id },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const consultationRes = await request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          physiotherapistId: therapistProfile!.id,
          complaint: 'Chat ownership access test.',
        })
        .expect(201);
      const consultationId = (consultationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const conversationRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({ consultationId })
        .expect(201);
      const conversationId = (conversationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .get(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe('You are not part of this conversation.');
    });

    it("returns 403 when non-participant patient sends message to another user's conversation", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Chat Sender A',
          email: 'patient-chat-sender-a@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Chat Receiver B',
          email: 'patient-chat-receiver-b@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBToken = (patientBRegisterRes.body as AuthResponse).data.accessToken;

      const therapistRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Chat Receiver',
          email: 'therapist-chat-receiver@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
      const therapistProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistUserId },
      });
      expect(therapistProfile).toBeTruthy();

      await prisma.physiotherapistProfile.update({
        where: { id: therapistProfile!.id },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const consultationRes = await request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          physiotherapistId: therapistProfile!.id,
          complaint: 'Chat ownership send test.',
        })
        .expect(201);
      const consultationId = (consultationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const conversationRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({ consultationId })
        .expect(201);
      const conversationId = (conversationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .post(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ content: 'I should not be able to post here.' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe('You are not part of this conversation.');
    });

    it("returns 403 when non-participant patient creates/gets conversation using another user's consultation", async () => {
      const patientARegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Chat Consultation Outsider',
          email: 'patient-chat-consultation-outsider@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientAToken = (patientARegisterRes.body as AuthResponse).data.accessToken;

      const patientBRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Patient Chat Consultation Owner',
          email: 'patient-chat-consultation-owner@mail.com',
          password: 'password123',
          role: UserRole.PATIENT,
        })
        .expect(201);
      const patientBToken = (patientBRegisterRes.body as AuthResponse).data.accessToken;

      const therapistRegisterRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Therapist Chat Consultation Owner',
          email: 'therapist-chat-consultation-owner@mail.com',
          password: 'password123',
          role: UserRole.PHYSIOTHERAPIST,
        })
        .expect(201);
      const therapistUserId = (therapistRegisterRes.body as AuthResponse).data.user.id;
      const therapistProfile = await prisma.physiotherapistProfile.findUnique({
        where: { userId: therapistUserId },
      });
      expect(therapistProfile).toBeTruthy();

      await prisma.physiotherapistProfile.update({
        where: { id: therapistProfile!.id },
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
        },
      });

      const consultationRes = await request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${patientBToken}`)
        .send({
          physiotherapistId: therapistProfile!.id,
          complaint: 'Outsider should not create/get conversation from this consultation.',
        })
        .expect(201);
      const consultationId = (consultationRes.body as ApiEnvelope<{ id: string }>).data.id;

      const res = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ consultationId })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(403);
      expect(res.body.error.message).toBe('You are not part of this consultation.');
    });
  });
});
