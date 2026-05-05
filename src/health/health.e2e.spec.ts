import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('Health endpoint (e2e-lite)', () => {
  let app: INestApplication;
  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /health returns ok when database query succeeds', async () => {
    prismaMock.$queryRaw.mockResolvedValue([1]);

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: { status: string; database: string } }) => {
        const { body } = res;
        expect(body).toEqual({
          status: 'ok',
          database: 'connected',
        });
      });
  });

  it('GET /health returns degraded when database query throws', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('db down'));

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: { status: string; database: string } }) => {
        const { body } = res;
        expect(body).toEqual({
          status: 'degraded',
          database: 'disconnected',
        });
      });
  });
});
