import { mapReviewResponse, reviewSourceType } from './review.helpers';

describe('review.helpers', () => {
  it('reviewSourceType returns BOOKING when consultationId is null', () => {
    expect(
      reviewSourceType({
        bookingId: 'b1',
        consultationId: null,
      }),
    ).toBe('BOOKING');
  });

  it('reviewSourceType returns CONSULTATION when consultationId is set', () => {
    expect(
      reviewSourceType({
        bookingId: null,
        consultationId: 'c1',
      }),
    ).toBe('CONSULTATION');
  });

  it('mapReviewResponse adds sourceType', () => {
    const mapped = mapReviewResponse({
      id: 'r1',
      bookingId: null,
      consultationId: 'c1',
      patientId: 'p1',
      physiotherapistId: 't1',
      rating: 4,
      comment: null,
      isHidden: false,
      moderationNote: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
    expect(mapped.sourceType).toBe('CONSULTATION');
  });
});
