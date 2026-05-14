import { ConsultationSlaTier } from '@prisma/client';
import {
  consultationSlaDeadline,
  consultationSlaWindowMinutes,
} from './consultation-sla.util';

describe('consultationSlaWindowMinutes', () => {
  it('uses fast window for FAST_ONLINE', () => {
    expect(
      consultationSlaWindowMinutes(ConsultationSlaTier.FAST_ONLINE, 10, 1440),
    ).toBe(10);
  });

  it('uses standard window for STANDARD', () => {
    expect(
      consultationSlaWindowMinutes(ConsultationSlaTier.STANDARD, 10, 1440),
    ).toBe(1440);
  });
});

describe('consultationSlaDeadline', () => {
  it('adds the correct window to startedAt', () => {
    const started = new Date('2026-05-14T12:00:00.000Z');
    const d = consultationSlaDeadline(
      started,
      ConsultationSlaTier.FAST_ONLINE,
      10,
      1440,
    );
    expect(d.toISOString()).toBe('2026-05-14T12:10:00.000Z');
  });
});
