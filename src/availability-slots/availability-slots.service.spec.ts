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
  const THERAPIST_USER = {
    sub: 'therapist-user-1',
    email: 't@mail.com',
    role: UserRole.PHYSIOTHERAPIST,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // createMine validations
  it('creates slot when window is valid and non-overlapping', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findFirst.mockResolvedValue(null);
    prismaMock.availabilitySlot.create.mockResolvedValue({ id: 'slot-1' });

    await service.createMine(
      THERAPIST_USER,
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
        THERAPIST_USER,
        {
          slotDate: '2099-06-02',
          startTime: '2099-06-01T09:00:00.000Z',
          endTime: '2099-06-01T10:00:00.000Z',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects create when slot overlaps existing availability', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findFirst.mockResolvedValue({ id: 'existing-slot' });

    await expect(
      service.createMine(
        THERAPIST_USER,
        {
          slotDate: '2099-06-01',
          startTime: '2099-06-01T09:30:00.000Z',
          endTime: '2099-06-01T10:30:00.000Z',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects create when startTime is in the past', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });

    await expect(
      service.createMine(
        THERAPIST_USER,
        {
          slotDate: '2020-01-01',
          startTime: '2020-01-01T09:00:00.000Z',
          endTime: '2020-01-01T10:00:00.000Z',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // updateMine / removeMine guards
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
        THERAPIST_USER,
        'slot-1',
        { startTime: '2099-06-01T11:00:00.000Z' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects setting isAvailable=true when slot has blocking booking', async () => {
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
    prismaMock.booking.count.mockResolvedValue(2);

    await expect(
      service.updateMine(
        THERAPIST_USER,
        'slot-1',
        { isAvailable: true },
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
        THERAPIST_USER,
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
        THERAPIST_USER,
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

    const result = await service.removeMine(THERAPIST_USER, 'slot-1');

    expect(prismaMock.availabilitySlot.delete).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
    });
    expect(result).toEqual({ message: 'Availability slot deleted.' });
  });

  // list endpoints behavior
  it('builds listMine query with pagination and date range filters', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
    });
    prismaMock.availabilitySlot.findMany.mockResolvedValue([
      { id: 'slot-1' },
      { id: 'slot-2' },
    ]);
    prismaMock.availabilitySlot.count.mockResolvedValue(12);
    prismaMock.$transaction.mockResolvedValue([
      [{ id: 'slot-1' }, { id: 'slot-2' }],
      12,
    ]);

    const result = await service.listMine(THERAPIST_USER, {
      page: 2,
      limit: 5,
      from: '2099-06-01',
      to: '2099-06-30',
    });

    expect(prismaMock.availabilitySlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: expect.objectContaining({
          physiotherapistId: 'therapist-profile-1',
          slotDate: {
            gte: new Date('2099-06-01T00:00:00.000Z'),
            lte: new Date('2099-06-30T00:00:00.000Z'),
          },
        }),
      }),
    );
    expect(prismaMock.availabilitySlot.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          physiotherapistId: 'therapist-profile-1',
        }),
      }),
    );
    expect(result).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
      items: [{ id: 'slot-1' }, { id: 'slot-2' }],
    });
  });

  it('builds public list query with upcoming and available constraints', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-profile-1',
      verificationStatus: TherapistVerificationStatus.APPROVED,
    });
    prismaMock.$transaction.mockResolvedValue([[{ id: 'slot-1' }], 1]);

    const result = await service.listForTherapistProfile(
      'therapist-profile-1',
      {
        page: 1,
        limit: 10,
        from: '2099-06-01',
      },
    );

    const findManyCallArg = prismaMock.availabilitySlot.findMany.mock.calls[0][0];
    expect(findManyCallArg.where).toEqual(
      expect.objectContaining({
        physiotherapistId: 'therapist-profile-1',
        isAvailable: true,
        slotDate: {
          gte: new Date('2099-06-01T00:00:00.000Z'),
        },
      }),
    );
    expect(findManyCallArg.where.startTime).toEqual(
      expect.objectContaining({ gte: expect.any(Date) }),
    );
    expect(result).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      items: [{ id: 'slot-1' }],
    });
  });
});
