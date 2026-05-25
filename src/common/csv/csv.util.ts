/** UTF-8 BOM so Excel opens Indonesian CSV with correct encoding. */
export const CSV_UTF8_BOM = '\uFEFF';

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...bodyLines].join('\r\n');
}

export function parseContentDispositionFilename(
  header: string | null | undefined,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return fallback;
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  if (plain?.[1]) {
    return plain[1];
  }
  return fallback;
}
