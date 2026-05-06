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

describe('Auth integration (real DB, no service mocks)', () => {
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
});
