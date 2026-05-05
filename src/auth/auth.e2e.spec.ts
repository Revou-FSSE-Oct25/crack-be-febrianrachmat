import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('Auth public endpoints (e2e-lite)', () => {
  let app: INestApplication;
  class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'user-guard-1',
        email: 'guard@mail.com',
        role: UserRole.PATIENT,
      };
      return true;
    }
  }
  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
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

  it('POST /auth/register delegates to service and returns payload', async () => {
    authServiceMock.register.mockResolvedValue({
      id: 'user-1',
      email: 'patient@mail.com',
      role: UserRole.PATIENT,
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Patient One',
        email: 'patient@mail.com',
        password: 'password123',
        role: UserRole.PATIENT,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'user-1',
          email: 'patient@mail.com',
          role: UserRole.PATIENT,
        });
      });
  });

  it('POST /auth/login delegates to service and returns token payload', async () => {
    authServiceMock.login.mockResolvedValue({
      accessToken: 'jwt-token',
      user: { id: 'user-1', role: UserRole.PATIENT },
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'patient@mail.com',
        password: 'password123',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          accessToken: 'jwt-token',
          user: { id: 'user-1', role: UserRole.PATIENT },
        });
      });
  });

  it('GET /auth/me returns current request user payload', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          sub: 'user-guard-1',
          email: 'guard@mail.com',
          role: UserRole.PATIENT,
        });
      });
  });
});
