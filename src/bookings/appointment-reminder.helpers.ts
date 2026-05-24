/**
 * Returns true when `now` falls in the send window before `appointmentDate`.
 * Default: notify once around `hoursBefore` (e.g. 24h) before the appointment.
 */
export function isWithinReminderWindow(
  appointmentDate: Date,
  now: Date,
  hoursBefore: number,
  windowMinutes: number,
): boolean {
  const hoursMs = hoursBefore * 60 * 60 * 1000;
  const windowMs = windowMinutes * 60 * 1000;
  const targetMs = appointmentDate.getTime() - hoursMs;
  const nowMs = now.getTime();
  return nowMs >= targetMs - windowMs / 2 && nowMs <= targetMs + windowMs / 2;
}

export function parseReminderHoursBefore(raw: string | undefined): number {
  const n = Number(raw ?? 24);
  if (!Number.isFinite(n) || n < 1 || n > 168) {
    return 24;
  }
  return n;
}

export function parseReminderWindowMinutes(raw: string | undefined): number {
  const n = Number(raw ?? 60);
  if (!Number.isFinite(n) || n < 15 || n > 360) {
    return 60;
  }
  return n;
}

export function formatAppointmentWhenId(appointmentDate: Date): string {
  return appointmentDate.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}
