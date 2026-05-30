import {
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
} from './ics.util';

describe('ics.util', () => {
  it('escapeIcsText escapes separators and newlines', () => {
    expect(escapeIcsText('plain')).toBe('plain');
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    expect(escapeIcsText('line1\nline2')).toBe('line1\\nline2');
  });

  it('formatIcsUtc strips punctuation from ISO date', () => {
    expect(formatIcsUtc(new Date('2026-05-15T09:30:00.000Z'))).toBe(
      '20260515T093000Z',
    );
  });

  it('foldIcsLine wraps long property lines', () => {
    const long = `SUMMARY:${'x'.repeat(90)}`;
    const folded = foldIcsLine(long);
    expect(folded).toContain('\r\n ');
    expect(folded.startsWith('SUMMARY:')).toBe(true);
  });

  it('buildIcsCalendar emits VCALENDAR with events', () => {
    const ics = buildIcsCalendar({
      prodId: '-//Crack//Calendar//ID',
      calendarName: 'Janji temu',
      dtStamp: new Date('2026-05-01T00:00:00.000Z'),
      events: [
        {
          uid: 'booking-1@crack',
          start: new Date('2026-05-15T09:00:00.000Z'),
          end: new Date('2026-05-15T10:00:00.000Z'),
          summary: 'Dr. Fisio · Kunjungan klinik',
          location: 'Jl. Klinik 1',
          description: 'Status: CONFIRMED',
        },
      ],
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:booking-1@crack');
    expect(ics).toContain('DTSTART:20260515T090000Z');
    expect(ics).toContain('DTEND:20260515T100000Z');
    expect(ics).toContain('SUMMARY:Dr. Fisio · Kunjungan klinik');
    expect(ics).toContain('LOCATION:Jl. Klinik 1');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });
});
