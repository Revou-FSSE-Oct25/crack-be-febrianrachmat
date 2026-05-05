import { BadRequestException } from '@nestjs/common';
import { BookingStatus, ConsultationStatus, UserRole } from '@prisma/client';
import { BookingsService } from './bookings.service';

describe('BookingsService booking transition guard', () => {
  const prismaMock = {
    patientProfile: { findUnique: jest.fn() },
    physiotherapistProfile: { findUnique: jest.fn() },
    consultation: { findUnique: jest.fn() },
    availabilitySlot: { findUnique: jest.fn() },
    booking: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const notificationsMock = {
    createSystemNotification: jest.fn(),
  };
  const service = new BookingsService(
    prismaMock as never,
    notificationsMock as never,
  );
  const callAssertTransition = (
    currentStatus: BookingStatus,
    nextStatus: BookingStatus,
  ) =>
    (
      service as unknown as {
        assertValidBookingTransition: (
          from: BookingStatus,
          to: BookingStatus,
        ) => void;
      }
    ).assertValidBookingTransition(currentStatus, nextStatus);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows valid transition PENDING -> CONFIRMED', () => {
    expect(() => callAssertTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).not.toThrow();
  });

  it('rejects skipped transition PENDING -> COMPLETED', () => {
    expect(() => callAssertTransition(BookingStatus.PENDING, BookingStatus.COMPLETED)).toThrow(
      BadRequestException,
    );
  });

  it('rejects no-op transition CONFIRMED -> CONFIRMED', () => {
    expect(() => callAssertTransition(BookingStatus.CONFIRMED, BookingStatus.CONFIRMED)).toThrow(
      BadRequestException,
    );
  });

  it('rejects cancellation from COMPLETED', () => {
    expect(() => callAssertTransition(BookingStatus.COMPLETED, BookingStatus.CANCELLED)).toThrow(
      BadRequestException,
    );
  });

  it('accepts booking when appointmentDate matches selected slot startTime', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
      userId: 'therapist-user-1',
      verificationStatus: 'APPROVED',
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-1',
      isAvailable: true,
      startTime: new Date('2026-05-10T09:00:00.000Z'),
      endTime: new Date('2099-05-10T10:00:00.000Z'),
    });
    const txBookingCreate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    const txSlotUpdate = jest.fn().mockResolvedValue({ id: 'slot-1' });
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) =>
        cb({
          booking: { create: txBookingCreate },
          availabilitySlot: { update: txSlotUpdate },
        }),
    );

    await service.createBooking(
      { sub: 'patient-user-1', email: 'p@mail.com', role: UserRole.PATIENT },
      {
        physiotherapistId: 'therapist-1',
        slotId: 'slot-1',
        appointmentType: 'CLINIC_VISIT',
        appointmentDate: '2026-05-10T09:00:00.000Z',
        clinicAddress: 'Jl. Klinik Utama 123',
      },
    );

    expect(txBookingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentDate: new Date('2026-05-10T09:00:00.000Z'),
        }),
      }),
    );
    expect(txSlotUpdate).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isAvailable: false },
    });
  });

  it('rejects booking when appointmentDate mismatches slot startTime', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
      userId: 'therapist-user-1',
      verificationStatus: 'APPROVED',
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-1',
      isAvailable: true,
      startTime: new Date('2026-05-10T09:00:00.000Z'),
      endTime: new Date('2099-05-10T10:00:00.000Z'),
    });

    await expect(
      service.createBooking(
        { sub: 'patient-user-1', email: 'p@mail.com', role: UserRole.PATIENT },
        {
          physiotherapistId: 'therapist-1',
          slotId: 'slot-1',
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: '2026-05-10T11:00:00.000Z',
          clinicAddress: 'Jl. Klinik Utama 123',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('releases slot back to available when booking is cancelled', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      slotId: 'slot-1',
      status: BookingStatus.PENDING,
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({ userId: 'patient-user-1' });
    const txBookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    const txSlotUpdate = jest.fn().mockResolvedValue({
      id: 'slot-1',
      isAvailable: true,
    });
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) =>
        cb({
          booking: { update: txBookingUpdate },
          availabilitySlot: { update: txSlotUpdate },
        }),
    );

    await service.updateBookingStatus(
      { sub: 'admin-user-1', email: 'admin@mail.com', role: UserRole.ADMIN },
      'booking-1',
      { status: BookingStatus.CANCELLED },
    );

    expect(txSlotUpdate).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { isAvailable: true },
    });
  });

  it('rejects booking when consultation therapist mismatches selected physiotherapist', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
      userId: 'therapist-user-1',
      verificationStatus: 'APPROVED',
    });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-2',
      status: ConsultationStatus.ACCEPTED,
    });

    await expect(
      service.createBooking(
        { sub: 'patient-user-1', email: 'p@mail.com', role: UserRole.PATIENT },
        {
          consultationId: 'consultation-1',
          physiotherapistId: 'therapist-1',
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: '2099-05-10T09:00:00.000Z',
          clinicAddress: 'Jl. Klinik Utama 123',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects booking when consultation status is REJECTED', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
      userId: 'therapist-user-1',
      verificationStatus: 'APPROVED',
    });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      physiotherapistId: 'therapist-1',
      status: ConsultationStatus.REJECTED,
    });

    await expect(
      service.createBooking(
        { sub: 'patient-user-1', email: 'p@mail.com', role: UserRole.PATIENT },
        {
          consultationId: 'consultation-1',
          physiotherapistId: 'therapist-1',
          appointmentType: 'CLINIC_VISIT',
          appointmentDate: '2099-05-10T09:00:00.000Z',
          clinicAddress: 'Jl. Klinik Utama 123',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
