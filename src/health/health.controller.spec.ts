import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when database is connected', async () => {
    const prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(prismaMock as never);

    await expect(controller.checkHealth()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('returns degraded when database is disconnected', async () => {
    const prismaMock = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const controller = new HealthController(prismaMock as never);

    await expect(controller.checkHealth()).resolves.toEqual({
      status: 'degraded',
      database: 'disconnected',
    });
  });
});
