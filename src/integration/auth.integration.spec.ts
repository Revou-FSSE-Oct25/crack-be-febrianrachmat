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
});
