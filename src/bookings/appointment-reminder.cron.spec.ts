import { AppointmentReminderCronService } from './appointment-reminder.cron';
import { BookingsService } from './bookings.service';

describe('AppointmentReminderCronService', () => {
  const bookingsService = {
    processAppointmentReminders: jest.fn(),
  } as unknown as BookingsService;

  const originalEnv = process.env.APPOINTMENT_REMINDER_CRON;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.APPOINTMENT_REMINDER_CRON;
    } else {
      process.env.APPOINTMENT_REMINDER_CRON = originalEnv;
    }
    jest.clearAllMocks();
  });

  it('skips reminder scan when APPOINTMENT_REMINDER_CRON=false', async () => {
    process.env.APPOINTMENT_REMINDER_CRON = 'false';
    const cron = new AppointmentReminderCronService(bookingsService);
    await cron.handleReminderScan();
    expect(bookingsService.processAppointmentReminders).not.toHaveBeenCalled();
  });

  it('runs reminder scan when cron enabled', async () => {
    delete process.env.APPOINTMENT_REMINDER_CRON;
    jest
      .spyOn(bookingsService, 'processAppointmentReminders')
      .mockResolvedValue({ checked: 2, sent: 1 });
    const cron = new AppointmentReminderCronService(bookingsService);
    await cron.handleReminderScan();
    expect(bookingsService.processAppointmentReminders).toHaveBeenCalled();
  });
});
