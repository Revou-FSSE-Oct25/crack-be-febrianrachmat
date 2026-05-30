export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
};

export type BuildIcsCalendarOptions = {
  prodId: string;
  calendarName: string;
  events: IcsEvent[];
  dtStamp?: Date;
};

/** Escape special chars in iCalendar text values (RFC 5545). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/** UTC timestamp for DTSTART / DTEND / DTSTAMP. */
export function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Fold long lines at 75 octets (RFC 5545). */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) {
    return line;
  }

  const parts: string[] = [];
  let current = '';

  for (const char of line) {
    const candidate = current + char;
    if (encoder.encode(candidate).length > 75) {
      parts.push(current);
      current = ` ${char}`;
    } else {
      current = candidate;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts.join('\r\n');
}

function icsTextProperty(name: string, value: string): string {
  return foldIcsLine(`${name}:${escapeIcsText(value)}`);
}

function icsDateProperty(name: string, date: Date): string {
  return `${name}:${formatIcsUtc(date)}`;
}

export function buildIcsCalendar(options: BuildIcsCalendarOptions): string {
  const dtStamp = options.dtStamp ?? new Date();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${options.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    icsTextProperty('X-WR-CALNAME', options.calendarName),
  ];

  for (const event of options.events) {
    lines.push('BEGIN:VEVENT');
    lines.push(icsTextProperty('UID', event.uid));
    lines.push(icsDateProperty('DTSTAMP', dtStamp));
    lines.push(icsDateProperty('DTSTART', event.start));
    lines.push(icsDateProperty('DTEND', event.end));
    lines.push(icsTextProperty('SUMMARY', event.summary));
    if (event.location) {
      lines.push(icsTextProperty('LOCATION', event.location));
    }
    if (event.description) {
      lines.push(icsTextProperty('DESCRIPTION', event.description));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
