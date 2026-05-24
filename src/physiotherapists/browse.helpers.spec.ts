import {
  attachReviewStats,
  resolveBrowseOrderBy,
  sortProfileIdsByRating,
} from './browse.helpers';

describe('browse.helpers', () => {
  it('resolveBrowseOrderBy maps sort keys to Prisma order', () => {
    expect(resolveBrowseOrderBy('visit_fee_asc')).toEqual({ visitFee: 'asc' });
    expect(resolveBrowseOrderBy('name_asc')).toEqual({
      user: { fullName: 'asc' },
    });
    expect(resolveBrowseOrderBy(undefined)).toEqual({ createdAt: 'desc' });
  });

  it('attachReviewStats computes average and strips reviews', () => {
    const mapped = attachReviewStats({
      id: 'p1',
      reviews: [{ rating: 4 }, { rating: 5 }],
    });
    expect(mapped.averageRating).toBe(4.5);
    expect(mapped.reviewCount).toBe(2);
    expect(mapped).not.toHaveProperty('reviews');
  });

  it('sortProfileIdsByRating puts unrated profiles last when desc', () => {
    const sorted = sortProfileIdsByRating(
      ['a', 'b', 'c'],
      [
        { physiotherapistId: 'a', _avg: { rating: 3 } },
        { physiotherapistId: 'b', _avg: { rating: 5 } },
      ],
      'rating_desc',
    );
    expect(sorted[0]).toBe('b');
    expect(sorted[1]).toBe('a');
    expect(sorted[2]).toBe('c');
  });
});
