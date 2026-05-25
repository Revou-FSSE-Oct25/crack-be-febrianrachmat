/** Build last N calendar-day labels (UTC date string) oldest → newest. */
export function buildDayLabels(days: number, now = new Date()): string[] {
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }
  return labels;
}

export function startOfUtcDay(daysAgo: number, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

export function toUtcDateKey(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

export function countByDay(
  rows: Array<{ createdAt: Date }>,
  labels: string[],
): number[] {
  const counts = new Map(labels.map((label) => [label, 0]));
  for (const row of rows) {
    const key = toUtcDateKey(row.createdAt);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return labels.map((label) => counts.get(label) ?? 0);
}

export function sumMoneyByDay(
  rows: Array<{ createdAt: Date; amount: { toString(): string } }>,
  labels: string[],
): number[] {
  const sums = new Map(labels.map((label) => [label, 0]));
  for (const row of rows) {
    const key = toUtcDateKey(row.createdAt);
    if (!sums.has(key)) continue;
    const n = Number(row.amount.toString());
    if (Number.isFinite(n)) {
      sums.set(key, (sums.get(key) ?? 0) + n);
    }
  }
  return labels.map((label) => sums.get(label) ?? 0);
}

export function clampAnalyticsDays(days?: number): number {
  const n = days ?? 30;
  return Math.min(90, Math.max(7, Math.floor(n)));
}
