import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { compare } from 'bcryptjs';

describe('UsersService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    patientProfile: { findUnique: jest.fn() },
    physiotherapistProfile: { findUnique: jest.fn() },
    booking: { count: jest.fn(), findFirst: jest.fn() },
    consultation: { count: jest.fn(), findFirst: jest.fn() },
    transaction: { count: jest.fn() },
    review: { count: jest.fn() },
  };

  const service = new UsersService(prismaMock as never);
  const PATIENT_USER = {
    sub: 'patient-user-1',
    email: 'p@mail.com',
    role: UserRole.PATIENT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deactivates non-admin account when password is valid', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: PATIENT_USER.sub,
      passwordHash: 'hash',
      role: UserRole.PATIENT,
      isActive: true,
    });
    (compare as jest.Mock).mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue({ id: PATIENT_USER.sub });

    const result = await service.deactivateAccount(PATIENT_USER, {
      currentPassword: 'password123',
    });

    expect(result.message).toContain('dinonaktifkan');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: PATIENT_USER.sub },
      data: { isActive: false },
    });
  });

  it('rejects admin self-deactivation', async () => {
    await expect(
      service.deactivateAccount(
        { ...PATIENT_USER, role: UserRole.ADMIN },
        { currentPassword: 'password123' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects deactivate with wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: PATIENT_USER.sub,
      passwordHash: 'hash',
      role: UserRole.PATIENT,
      isActive: true,
    });
    (compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.deactivateAccount(PATIENT_USER, {
        currentPassword: 'wrong-pass',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns patient activity summary', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.booking.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    prismaMock.consultation.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prismaMock.transaction.count.mockResolvedValue(1);
    prismaMock.review.count.mockResolvedValue(2);
    prismaMock.booking.findFirst.mockResolvedValue({
      createdAt: new Date('2026-05-10T10:00:00Z'),
    });
    prismaMock.consultation.findFirst.mockResolvedValue(null);

    const summary = await service.getMyActivitySummary(PATIENT_USER);

    expect(summary.role).toBe(UserRole.PATIENT);
    if (summary.role !== UserRole.PATIENT) {
      throw new Error('expected patient summary');
    }
    expect(summary.bookings.total).toBe(5);
    expect(summary.consultations.total).toBe(4);
    expect(summary.transactionsPending).toBe(1);
    expect(summary.reviews).toBe(2);
  });

  it('throws when patient profile missing for activity summary', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue(null);
    await expect(
      service.getMyActivitySummary(PATIENT_USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
