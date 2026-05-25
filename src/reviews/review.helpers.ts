import { Review } from '@prisma/client';

export type ReviewSourceType = 'BOOKING' | 'CONSULTATION';

export function reviewSourceType(
  review: Pick<Review, 'bookingId' | 'consultationId'>,
): ReviewSourceType {
  return review.consultationId != null ? 'CONSULTATION' : 'BOOKING';
}

export function mapReviewResponse<T extends Review>(review: T) {
  return {
    ...review,
    sourceType: reviewSourceType(review),
  };
}
