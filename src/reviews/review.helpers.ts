import { Review } from '@prisma/client';

export type ReviewSourceType = 'BOOKING' | 'CONSULTATION';
export const REVIEW_MUTATION_WINDOW_HOURS = 72;
const REVIEW_MUTATION_WINDOW_MS = REVIEW_MUTATION_WINDOW_HOURS * 60 * 60 * 1000;

export function reviewSourceType(
  review: Pick<Review, 'bookingId' | 'consultationId'>,
): ReviewSourceType {
  return review.consultationId != null ? 'CONSULTATION' : 'BOOKING';
}

export function mapReviewResponse<T extends Review>(review: T) {
  const editableUntil = new Date(
    review.createdAt.getTime() + REVIEW_MUTATION_WINDOW_MS,
  );
  const isEditableByPatient = !review.isHidden && Date.now() <= editableUntil.getTime();
  return {
    ...review,
    sourceType: reviewSourceType(review),
    editableUntil,
    isEditableByPatient,
  };
}
