import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  ConsultationStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  const prismaMock = {
    patientProfile: { findUnique: jest.fn() },
    physiotherapistProfile: { findUnique: jest.fn() },
    consultation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    availabilitySlot: { findUnique: jest.fn() },
    booking: { findUnique: jest.fn(), findMany: jest.fn() },
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  /**
   * Helper: route `prisma.$transaction(cb)` through the same mocked Prisma
   * methods so service-level transactions can be observed in tests without
   * spinning up a real DB connection.
   */
  const wireDefault$transaction = () => {
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
    );
  };
  const notificationsMock = {
    createSystemNotification: jest.fn(),
  };
  const service = new BookingsService(
    prismaMock as never,
    notificationsMock as never,
  );
  const PATIENT_USER = {
    sub: 'patient-user-1',
    email: 'p@mail.com',
    role: UserRole.PATIENT,
  };
  const THERAPIST_USER = {
    sub: 'therapist-user-1',
    email: 't@mail.com',
    role: UserRole.PHYSIOTHERAPIST,
  };
  const ADMIN_USER = {
    sub: 'admin-user-1',
    email: 'a@mail.com',
    role: UserRole.ADMIN,
  };
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
    wireDefault$transaction();
  });

  // Booking status transition guards
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

  // createBooking validations
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
      PATIENT_USER,
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
        PATIENT_USER,
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

    await service.updateBookingStatus(ADMIN_USER, 'booking-1', {
      status: BookingStatus.CANCELLED,
    });

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
        PATIENT_USER,
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

  it('rejects booking when consultation status is CANCELLED', async () => {
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
      status: ConsultationStatus.CANCELLED,
    });

    await expect(
      service.createBooking(
        PATIENT_USER,
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

  // listMyConsultations / listMyBookings role-based behavior
  it('lists consultations for patient based on patient profile id', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.consultation.findMany.mockResolvedValue([{ id: 'consult-1' }]);

    const result = await service.listMyConsultations(PATIENT_USER, {
      page: 2,
      limit: 5,
    });

    expect(prismaMock.consultation.findMany).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual([{ id: 'consult-1' }]);
  });

  it('rejects listMyConsultations for PATIENT when patient profile is missing', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.listMyConsultations(PATIENT_USER, { page: 1, limit: 10 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists bookings for therapist based on therapist profile id', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
    });
    prismaMock.booking.findMany.mockResolvedValue([{ id: 'book-1' }]);

    const result = await service.listMyBookings(THERAPIST_USER, {
      page: 1,
      limit: 10,
    });

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      where: { physiotherapistId: 'therapist-1' },
      orderBy: { appointmentDate: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual([{ id: 'book-1' }]);
  });

  it('rejects listMyBookings for PHYSIOTHERAPIST when profile is missing', async () => {
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.listMyBookings(THERAPIST_USER, { page: 1, limit: 10 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists all consultations for admin without ownership filter', async () => {
    prismaMock.consultation.findMany.mockResolvedValue([{ id: 'consult-admin-1' }]);

    const result = await service.listMyConsultations(ADMIN_USER, {
      page: 1,
      limit: 10,
    });

    expect(prismaMock.consultation.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual([{ id: 'consult-admin-1' }]);
  });

  it('lists all bookings for admin without ownership filter', async () => {
    prismaMock.booking.findMany.mockResolvedValue([{ id: 'booking-admin-1' }]);

    const result = await service.listMyBookings(ADMIN_USER, {
      page: 3,
      limit: 5,
    });

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      orderBy: { appointmentDate: 'desc' },
      skip: 10,
      take: 5,
    });
    expect(result).toEqual([{ id: 'booking-admin-1' }]);
  });

  // Transaction flow validations
  it('creates transaction for own booking only', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      patientId: 'patient-1',
    });
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await service.createTransaction(
      PATIENT_USER,
      {
        bookingId: 'booking-1',
        amount: 150000,
        paymentMethod: 'BANK_TRANSFER',
      },
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          patientId: 'patient-1',
          status: TransactionStatus.PENDING,
        }),
      }),
    );
  });

  it('creates consultation transaction once therapist has accepted', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      status: ConsultationStatus.ACCEPTED,
    });
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-c-1' });

    await service.createTransaction(PATIENT_USER, {
      consultationId: 'consultation-1',
      amount: 150000,
      paymentMethod: 'BANK_TRANSFER',
    });

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consultationId: 'consultation-1',
          patientId: 'patient-1',
          status: TransactionStatus.PENDING,
        }),
      }),
    );
  });

  it('rejects consultation transaction before therapist accepts (status=REQUESTED)', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      status: ConsultationStatus.REQUESTED,
    });

    await expect(
      service.createTransaction(PATIENT_USER, {
        consultationId: 'consultation-1',
        amount: 150000,
        paymentMethod: 'BANK_TRANSFER',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate pending transaction on same consultation', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      status: ConsultationStatus.ACCEPTED,
    });
    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'tx-existing',
      status: TransactionStatus.PENDING,
    });

    await expect(
      service.createTransaction(PATIENT_USER, {
        consultationId: 'consultation-1',
        amount: 150000,
        paymentMethod: 'BANK_TRANSFER',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transaction when neither bookingId nor consultationId is provided', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.createTransaction(PATIENT_USER, {
        amount: 150000,
        paymentMethod: 'BANK_TRANSFER',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transaction when both bookingId and consultationId are provided', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.createTransaction(PATIENT_USER, {
        bookingId: 'booking-1',
        consultationId: 'consultation-1',
        amount: 150000,
        paymentMethod: 'BANK_TRANSFER',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transaction creation when booking is not owned by patient', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      patientId: 'patient-2',
    });

    await expect(
      service.createTransaction(
        PATIENT_USER,
        {
          bookingId: 'booking-1',
          amount: 150000,
          paymentMethod: 'BANK_TRANSFER',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks pending booking transaction as paid by admin', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      patientId: 'patient-1',
      bookingId: 'booking-1',
      consultationId: null,
      consultation: null,
      status: TransactionStatus.PENDING,
    });
    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.PAID,
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({
      id: 'patient-1',
      userId: 'user-patient-1',
    });
    notificationsMock.createSystemNotification.mockResolvedValue(undefined);

    await service.markTransactionPaidByAdmin('tx-1');

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
        data: expect.objectContaining({
          status: TransactionStatus.PAID,
        }),
      }),
    );
    // Booking-only transactions never touch consultation.
    expect(prismaMock.consultation.update).not.toHaveBeenCalled();
  });

  it('promotes consultation to IN_PROGRESS when admin marks its transaction paid', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-c-1',
      patientId: 'patient-1',
      bookingId: null,
      consultationId: 'consultation-1',
      consultation: {
        id: 'consultation-1',
        status: ConsultationStatus.ACCEPTED,
        physiotherapist: { userId: 'therapist-user-1' },
      },
      status: TransactionStatus.PENDING,
    });
    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-c-1',
      status: TransactionStatus.PAID,
    });
    prismaMock.consultation.update.mockResolvedValue({
      id: 'consultation-1',
      status: ConsultationStatus.IN_PROGRESS,
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({
      id: 'patient-1',
      userId: 'user-patient-1',
    });

    await service.markTransactionPaidByAdmin('tx-c-1');

    expect(prismaMock.consultation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'consultation-1' },
        data: expect.objectContaining({
          status: ConsultationStatus.IN_PROGRESS,
        }),
      }),
    );
  });

  it('still marks transaction paid by admin even if notification fails', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      patientId: 'patient-1',
      bookingId: 'booking-1',
      consultationId: null,
      consultation: null,
      status: TransactionStatus.PENDING,
    });
    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.PAID,
    });
    prismaMock.patientProfile.findUnique.mockResolvedValue({
      id: 'patient-1',
      userId: 'user-patient-1',
    });
    notificationsMock.createSystemNotification.mockRejectedValue(
      new Error('notification service down'),
    );

    await expect(service.markTransactionPaidByAdmin('tx-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.PAID,
      }),
    );
  });

  it('rejects mark paid by admin when transaction not found', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.markTransactionPaidByAdmin('tx-404')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects refund when transaction is not PAID', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.PENDING,
    });

    await expect(
      service.refundTransactionByAdmin('tx-1', { reason: 'Duplicate payment' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws not found when refund target transaction does not exist', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.refundTransactionByAdmin('tx-404', { reason: 'N/A' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists transactions filtered by current patient profile', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);

    const result = await service.listTransactions(PATIENT_USER, {
      page: 2,
      limit: 5,
    });

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual([{ id: 'tx-1' }]);
  });

  it('lists all transactions for admin without patient filter', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 'tx-1' }, { id: 'tx-2' }]);

    const result = await service.listTransactions(ADMIN_USER, {
      page: 1,
      limit: 10,
    });

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual([{ id: 'tx-1' }, { id: 'tx-2' }]);
  });
});
