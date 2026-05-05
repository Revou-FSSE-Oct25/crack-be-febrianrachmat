import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TherapistVerificationStatus, UserRole } from '@prisma/client';
import { AvailabilitySlotsService } from './availability-slots.service';

describe('AvailabilitySlotsService', () => {
  const prismaMock = {
    physiotherapistProfile: { findUnique: jest.fn() },
    availabilitySlot: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    booking: { count: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new AvailabilitySlotsService(prismaMock as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates slot when window is valid and non-overlapping', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findFirst.mockResolvedValue(null);
    prismaMock.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

    await service.createMine(
      {
        sub: 'therapist-user-1',
        email: 't@mail.com',
        role: UserRole.PHYSIOTHERAPIST,
      },
      {
        slotDate: '2099-06-01',
        startTime: '2099-06-01T09:00:00.000Z',
        endTime: '2099-06-01T10:00:00.000Z',
      },
    );

    expect(prismaMock.availabilitySlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          physiotherapistId: 'therapist-profile-1',
          isAvailable: true,
        }),
      }),
    );
  });

  it('rejects create when slotDate does not match start/end day', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });

    await expect(
      service.createMine(
        {
          sub: 'therapist-user-1',
          email: 't@mail.com',
          role: UserRole.PHYSIOTHERAPIST,
        },
        {
          slotDate: '2099-06-02',
          startTime: '2099-06-01T09:00:00.000Z',
          endTime: '2099-06-01T10:00:00.000Z',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks slot window update when active booking exists', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-profile-1',
      slotDate: new Date('2099-06-01T00:00:00.000Z'),
      startTime: new Date('2099-06-01T09:00:00.000Z'),
      endTime: new Date('2099-06-01T10:00:00.000Z'),
      isAvailable: false,
    });
    prismaMock.booking.count.mockResolvedValue(1);

    await expect(
      service.updateMine(
        {
          sub: 'therapist-user-1',
          email: 't@mail.com',
          role: UserRole.PHYSIOTHERAPIST,
        },
        'slot-1',
        { startTime: '2099-06-01T11:00:00.000Z' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects listForTherapistProfile when therapist is not approved', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
      verificationStatus: TherapistVerificationStatus.PENDING,
    });

    await expect(
      service.listForTherapistProfile('therapist-profile-1', {
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws not found when profile is missing on createMine', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.createMine(
        {
          sub: 'therapist-user-1',
          email: 't@mail.com',
          role: UserRole.PHYSIOTHERAPIST,
        },
        {
          slotDate: '2099-06-01',
          startTime: '2099-06-01T09:00:00.000Z',
          endTime: '2099-06-01T10:00:00.000Z',
        },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects removeMine when slot has active (non-cancelled) booking', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-profile-1',
      _count: { bookings: 1 },
    });

    await expect(
      service.removeMine(
        {
          sub: 'therapist-user-1',
          email: 't@mail.com',
          role: UserRole.PHYSIOTHERAPIST,
        },
        'slot-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes slot when no active booking exists', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-profile-1',
      _count: { bookings: 0 },
    });
    prismaMock.availabilitySlot.delete.mockResolvedValue({ id: 'slot-1' });

    const result = await service.removeMine(
      {
        sub: 'therapist-user-1',
        email: 't@mail.com',
        role: UserRole.PHYSIOTHERAPIST,
      },
      'slot-1',
    );

    expect(prismaMock.availabilitySlot.delete).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
    });
    expect(result).toEqual({ message: 'Availability slot deleted.' });
  });
});
