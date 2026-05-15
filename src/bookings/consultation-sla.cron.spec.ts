import { ConsultationSlaCronService } from './consultation-sla.cron';
import { BookingsService } from './bookings.service';

describe('ConsultationSlaCronService', () => {
  const bookingsService = {
    processConsultationSlaTimeouts: jest.fn(),
  } as unknown as BookingsService;

  let service: ConsultationSlaCronService;
  const originalEnv = process.env.CONSULTATION_SLA_CRON;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConsultationSlaCronService(bookingsService);
    (bookingsService.processConsultationSlaTimeouts as jest.Mock).mockResolvedValue({
      checked: 2,
      refunded: 1,
    });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CONSULTATION_SLA_CRON;
    } else {
      process.env.CONSULTATION_SLA_CRON = originalEnv;
    }
  });

  it('skips SLA scan when CONSULTATION_SLA_CRON=false', async () => {
    process.env.CONSULTATION_SLA_CRON = 'false';
    await service.handleSlaScan();
    expect(bookingsService.processConsultationSlaTimeouts).not.toHaveBeenCalled();
  });

  it('runs SLA scan when cron is enabled', async () => {
    delete process.env.CONSULTATION_SLA_CRON;
    await service.handleSlaScan();
    expect(bookingsService.processConsultationSlaTimeouts).toHaveBeenCalled();
  });

  it('does not throw when SLA scan fails', async () => {
    delete process.env.CONSULTATION_SLA_CRON;
    (bookingsService.processConsultationSlaTimeouts as jest.Mock).mockRejectedValue(
      new Error('db timeout'),
    );
    await expect(service.handleSlaScan()).resolves.toBeUndefined();
  });
});
