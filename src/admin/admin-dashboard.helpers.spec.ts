import {
  buildDayLabels,
  countByDay,
  sumMoneyByDay,
  clampAnalyticsDays,
} from './admin-dashboard.helpers';

describe('admin-dashboard.helpers', () => {
  it('clampAnalyticsDays enforces 7..90', () => {
    expect(clampAnalyticsDays(undefined)).toBe(30);
    expect(clampAnalyticsDays(3)).toBe(7);
    expect(clampAnalyticsDays(120)).toBe(90);
  });

  it('countByDay buckets rows into label series', () => {
    const labels = ['2026-05-23', '2026-05-24', '2026-05-25'];
    const counts = countByDay(
      [
        { createdAt: new Date('2026-05-23T10:00:00Z') },
        { createdAt: new Date('2026-05-23T12:00:00Z') },
        { createdAt: new Date('2026-05-25T08:00:00Z') },
      ],
      labels,
    );
    expect(counts).toEqual([2, 0, 1]);
  });

  it('sumMoneyByDay aggregates paid amounts per day', () => {
    const labels = ['2026-05-24', '2026-05-25'];
    const sums = sumMoneyByDay(
      [
        {
          createdAt: new Date('2026-05-24T10:00:00Z'),
          amount: { toString: () => '100000' },
        },
        {
          createdAt: new Date('2026-05-24T11:00:00Z'),
          amount: { toString: () => '50000' },
        },
      ],
      labels,
    );
    expect(sums[0]).toBe(150000);
    expect(sums[1]).toBe(0);
  });

  it('buildDayLabels returns ordered day keys', () => {
    const labels = buildDayLabels(3, new Date('2026-05-25T15:00:00Z'));
    expect(labels).toHaveLength(3);
    expect(labels[2]).toBe('2026-05-25');
  });
});
