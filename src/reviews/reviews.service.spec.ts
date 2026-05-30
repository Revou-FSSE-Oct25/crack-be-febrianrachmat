import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const prismaMock = {
    patientProfile: { findUnique: jest.fn() },
    physiotherapistProfile: { findUnique: jest.fn() },
    review: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
  };
  const notificationsMock = {
    createSystemNotification: jest.fn(),
  };
  const auditMock = {
    record: jest.fn(),
  };
  const service = new ReviewsService(
    prismaMock as never,
    notificationsMock as never,
    auditMock as never,
  );
  const PATIENT_USER = {
    sub: 'patient-user-1',
    email: 'p@mail.com',
    role: UserRole.PATIENT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows updating own review within editable window', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'review-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      rating: 5,
      comment: 'Great',
      isHidden: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.review.update.mockResolvedValue({
      id: 'review-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      rating: 4,
      comment: 'Updated',
      isHidden: false,
      createdAt: new Date(),
    });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      userId: 'therapist-user-1',
    });

    await service.updateMyReview(PATIENT_USER, 'review-1', {
      rating: 4,
      comment: ' Updated ',
    });

    expect(prismaMock.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: {
        rating: 4,
        comment: 'Updated',
      },
    });
  });

  it('rejects update when review is older than 72 hours', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'review-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      rating: 5,
      comment: 'Great',
      isHidden: false,
      createdAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.updateMyReview(PATIENT_USER, 'review-1', {
        comment: 'Still good',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update when review is hidden by moderation', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'review-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      rating: 5,
      comment: 'Great',
      isHidden: true,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.updateMyReview(PATIENT_USER, 'review-1', {
        comment: 'Edited',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects delete when review is older than 72 hours', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'review-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      rating: 5,
      comment: 'Great',
      isHidden: false,
      createdAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.deleteMyReview(PATIENT_USER, 'review-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update for non-owner patient', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'review-1',
      patientId: 'patient-2',
      physiotherapistId: 'therapist-1',
      rating: 5,
      comment: 'Great',
      isHidden: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.updateMyReview(PATIENT_USER, 'review-1', {
        rating: 3,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
