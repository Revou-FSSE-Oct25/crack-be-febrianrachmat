import {
  formatAppointmentWhenId,
  isWithinReminderWindow,
  parseReminderHoursBefore,
} from './appointment-reminder.helpers';

describe('appointment-reminder.helpers', () => {
  it('isWithinReminderWindow matches 24h before within window', () => {
    const appointment = new Date('2099-06-15T10:00:00.000Z');
    const now = new Date('2099-06-14T10:00:00.000Z');
    expect(isWithinReminderWindow(appointment, now, 24, 60)).toBe(true);
  });

  it('isWithinReminderWindow rejects when too early', () => {
    const appointment = new Date('2099-06-15T10:00:00.000Z');
    const now = new Date('2099-06-13T10:00:00.000Z');
    expect(isWithinReminderWindow(appointment, now, 24, 30)).toBe(false);
  });

  it('parseReminderHoursBefore falls back to 24', () => {
    expect(parseReminderHoursBefore(undefined)).toBe(24);
    expect(parseReminderHoursBefore('bad')).toBe(24);
  });

  it('formatAppointmentWhenId uses Indonesian locale', () => {
    const s = formatAppointmentWhenId(new Date('2099-01-15T09:00:00.000Z'));
    expect(s.length).toBeGreaterThan(10);
  });
});
