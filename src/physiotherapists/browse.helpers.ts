import { Prisma } from '@prisma/client';

export const BROWSE_SORT_VALUES = [
  'newest',
  'name_asc',
  'name_desc',
  'visit_fee_asc',
  'visit_fee_desc',
  'consultation_fee_asc',
  'consultation_fee_desc',
  'rating_desc',
  'rating_asc',
] as const;

export type BrowseSortValue = (typeof BROWSE_SORT_VALUES)[number];

export function isRatingSort(
  sort?: string,
): sort is 'rating_desc' | 'rating_asc' {
  return sort === 'rating_desc' || sort === 'rating_asc';
}

export function resolveBrowseOrderBy(
  sort?: string,
): Prisma.PhysiotherapistProfileOrderByWithRelationInput {
  switch (sort) {
    case 'name_asc':
      return { user: { fullName: 'asc' } };
    case 'name_desc':
      return { user: { fullName: 'desc' } };
    case 'visit_fee_asc':
      return { visitFee: 'asc' };
    case 'visit_fee_desc':
      return { visitFee: 'desc' };
    case 'consultation_fee_asc':
      return { consultationFee: 'asc' };
    case 'consultation_fee_desc':
      return { consultationFee: 'desc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

type ReviewRatingRow = { rating: number };

export type BrowseProfileWithReviews = {
  id: string;
  reviews?: ReviewRatingRow[];
  [key: string]: unknown;
};

export function attachReviewStats<T extends BrowseProfileWithReviews>(
  profile: T,
): T & { averageRating: number | null; reviewCount: number } {
  const ratings = (profile.reviews ?? []).map((r) => r.rating);
  const reviewCount = ratings.length;
  const averageRating =
    reviewCount > 0
      ? Math.round((ratings.reduce((sum, n) => sum + n, 0) / reviewCount) * 10) /
        10
      : null;
  const { reviews: _reviews, ...rest } = profile;
  return {
    ...(rest as T),
    averageRating,
    reviewCount,
  };
}

export function sortProfileIdsByRating(
  profileIds: string[],
  aggregates: Array<{
    physiotherapistId: string;
    _avg: { rating: number | null };
  }>,
  sort: 'rating_desc' | 'rating_asc',
): string[] {
  const avgById = new Map(
    aggregates.map((row) => [row.physiotherapistId, row._avg.rating ?? null]),
  );

  return [...profileIds].sort((a, b) => {
    const avgA = avgById.get(a);
    const avgB = avgById.get(b);
    const hasA = avgA != null;
    const hasB = avgB != null;
    if (!hasA && !hasB) return 0;
    if (!hasA) return 1;
    if (!hasB) return -1;
    const diff = (avgB as number) - (avgA as number);
    return sort === 'rating_desc' ? diff : -diff;
  });
}
