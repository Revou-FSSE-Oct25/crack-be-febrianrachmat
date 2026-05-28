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
    availabilitySlot: { findUnique: jest.fn(), updateMany: jest.fn() },
    booking: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: { findFirst: jest.fn() },
    message: { count: jest.fn() },
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
  const configMock = {
    get: jest.fn().mockReturnValue(undefined),
  };
  const auditMock = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BookingsService(
    prismaMock as never,
    notificationsMock as never,
    configMock as never,
    auditMock as never,
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
      visitFee: 175000,
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-1',
      isAvailable: true,
      startTime: new Date('2026-05-10T09:00:00.000Z'),
      endTime: new Date('2099-05-10T10:00:00.000Z'),
    });
    const txBookingCreate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    const txSlotClaim = jest.fn().mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) =>
        cb({
          booking: { create: txBookingCreate },
          availabilitySlot: { updateMany: txSlotClaim },
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

    expect(txSlotClaim).toHaveBeenCalledWith({
      where: {
        id: 'slot-1',
        physiotherapistId: 'therapist-1',
        isAvailable: true,
      },
      data: { isAvailable: false },
    });
    expect(txBookingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentDate: new Date('2026-05-10T09:00:00.000Z'),
        }),
      }),
    );
    expect(txSlotClaim.mock.invocationCallOrder[0]).toBeLessThan(
      txBookingCreate.mock.invocationCallOrder[0],
    );
  });

  it('rejects slot booking when slot was claimed concurrently', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
      userId: 'therapist-user-1',
      verificationStatus: 'APPROVED',
      visitFee: 100000,
    });
    prismaMock.availabilitySlot.findUnique.mockResolvedValue({
      id: 'slot-1',
      physiotherapistId: 'therapist-1',
      isAvailable: true,
      startTime: new Date('2026-05-10T09:00:00.000Z'),
      endTime: new Date('2099-05-10T10:00:00.000Z'),
    });
    const txSlotClaim = jest.fn().mockResolvedValue({ count: 0 });
    const txBookingCreate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) =>
        cb({
          booking: { create: txBookingCreate },
          availabilitySlot: { updateMany: txSlotClaim },
        }),
    );

    await expect(
      service.createBooking(PATIENT_USER, {
        physiotherapistId: 'therapist-1',
        slotId: 'slot-1',
        appointmentType: 'CLINIC_VISIT',
        appointmentDate: '2026-05-10T09:00:00.000Z',
        clinicAddress: 'Jl. Klinik Utama 123',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(txBookingCreate).not.toHaveBeenCalled();
  });

  it('rejects booking when appointmentDate mismatches slot startTime', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.physiotherapistProfile.findUnique.mockResolvedValue({
      id: 'therapist-1',
      userId: 'therapist-user-1',
      verificationStatus: 'APPROVED',
      visitFee: 175000,
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
          transaction: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
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
      visitFee: 175000,
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
      visitFee: 175000,
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
      status: BookingStatus.CONFIRMED,
      visitFeeSnapshot: 199000,
    });
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await service.createTransaction(
      PATIENT_USER,
      {
        bookingId: 'booking-1',
        paymentProofUrl: 'https://example.com/payment-proof.png',
        paymentMethod: 'BANK_TRANSFER',
      },
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          patientId: 'patient-1',
          status: TransactionStatus.PENDING,
          paymentProofUrl: 'https://example.com/payment-proof.png',
        }),
      }),
    );
    const arg = prismaMock.transaction.create.mock.calls[0][0] as {
      data: { amount: { toString(): string } };
    };
    expect(arg.data.amount.toString()).toBe('199000');
  });

  it('creates consultation transaction once therapist has accepted', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      status: ConsultationStatus.ACCEPTED,
      feeSnapshot: 150000,
    });
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-c-1' });

    await service.createTransaction(PATIENT_USER, {
      consultationId: 'consultation-1',
      paymentProofUrl: 'https://example.com/payment-proof.png',
      paymentMethod: 'BANK_TRANSFER',
    });

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consultationId: 'consultation-1',
          patientId: 'patient-1',
          status: TransactionStatus.PENDING,
          paymentProofUrl: 'https://example.com/payment-proof.png',
        }),
      }),
    );
    const arg = prismaMock.transaction.create.mock.calls[0][0] as {
      data: { amount: { toString(): string } };
    };
    expect(arg.data.amount.toString()).toBe('150000');
  });

  it('rejects consultation transaction before therapist accepts (status=REQUESTED)', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.consultation.findUnique.mockResolvedValue({
      id: 'consultation-1',
      patientId: 'patient-1',
      status: ConsultationStatus.REQUESTED,
      feeSnapshot: 150000,
    });

    await expect(
      service.createTransaction(PATIENT_USER, {
        consultationId: 'consultation-1',
        paymentProofUrl: 'https://example.com/payment-proof.png',
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
      feeSnapshot: 150000,
    });
    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'tx-existing',
      status: TransactionStatus.PENDING,
    });

    await expect(
      service.createTransaction(PATIENT_USER, {
        consultationId: 'consultation-1',
        paymentProofUrl: 'https://example.com/payment-proof.png',
        paymentMethod: 'BANK_TRANSFER',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transaction when neither bookingId nor consultationId is provided', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });

    await expect(
      service.createTransaction(PATIENT_USER, {
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
        paymentMethod: 'BANK_TRANSFER',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transaction creation when booking is not owned by patient', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      patientId: 'patient-2',
      visitFeeSnapshot: 100,
    });

    await expect(
      service.createTransaction(
        PATIENT_USER,
        {
          bookingId: 'booking-1',
          paymentProofUrl: 'https://example.com/payment-proof.png',
          paymentMethod: 'BANK_TRANSFER',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects booking transaction when payment proof is missing', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({ id: 'patient-1' });
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      patientId: 'patient-1',
      status: BookingStatus.CONFIRMED,
      visitFeeSnapshot: 100,
    });
    prismaMock.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.createTransaction(PATIENT_USER, {
        bookingId: 'booking-1',
        paymentMethod: 'BANK_TRANSFER',
      }),
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
      paymentProofUrl: 'https://example.com/payment-proof.png',
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

    await service.markTransactionPaidByAdmin('tx-1', ADMIN_USER);

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
      paymentProofUrl: 'https://example.com/payment-proof.png',
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

    await service.markTransactionPaidByAdmin('tx-c-1', ADMIN_USER);

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
      paymentProofUrl: 'https://example.com/payment-proof.png',
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

    await expect(
      service.markTransactionPaidByAdmin('tx-1', ADMIN_USER),
    ).resolves.toEqual(
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

  it('rejects mark paid by admin when payment proof is missing', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      patientId: 'patient-1',
      bookingId: 'booking-1',
      consultationId: null,
      consultation: null,
      status: TransactionStatus.PENDING,
      paymentProofUrl: null,
    });

    await expect(service.markTransactionPaidByAdmin('tx-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects refund when transaction is not PAID', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.PENDING,
    });

    await expect(
      service.refundTransactionByAdmin('tx-1', { reason: 'Duplicate payment' }, ADMIN_USER),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws not found when refund target transaction does not exist', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.refundTransactionByAdmin('tx-404', { reason: 'N/A' }, ADMIN_USER),
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

  it('processes appointment reminders only for paid upcoming bookings', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-05-14T10:00:00.000Z').getTime());
    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        appointmentType: 'CLINIC_VISIT',
        clinicAddress: 'Klinik Sehat',
        homeVisitAddress: null,
        appointmentDate: new Date('2099-05-15T10:00:00.000Z'),
        patient: { user: { id: 'patient-user-1', fullName: 'Patient One' } },
        physiotherapist: {
          user: { id: 'therapist-user-1', fullName: 'Therapist One' },
        },
      },
    ]);
    prismaMock.booking.update.mockResolvedValue({
      id: 'booking-1',
      appointmentReminderSentAt: new Date('2099-05-14T10:00:00.000Z'),
    });

    const result = await service.processAppointmentReminders();

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
          transactions: { some: { status: TransactionStatus.PAID } },
          appointmentReminderSentAt: null,
        }),
      }),
    );
    expect(notificationsMock.createSystemNotification).toHaveBeenCalledTimes(2);
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { appointmentReminderSentAt: expect.any(Date) },
    });
    expect(result).toEqual({ checked: 1, sent: 1 });
    jest.useRealTimers();
  });

  it('skips reminder send when candidate is outside reminder window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-05-13T10:00:00.000Z').getTime());
    prismaMock.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        appointmentType: 'HOME_VISIT',
        clinicAddress: null,
        homeVisitAddress: 'Jl. Rumah 12',
        appointmentDate: new Date('2099-05-15T10:00:00.000Z'),
        patient: { user: { id: 'patient-user-1', fullName: 'Patient One' } },
        physiotherapist: {
          user: { id: 'therapist-user-1', fullName: 'Therapist One' },
        },
      },
    ]);

    const result = await service.processAppointmentReminders();

    expect(notificationsMock.createSystemNotification).not.toHaveBeenCalled();
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, sent: 0 });
    jest.useRealTimers();
  });

  it('triggers manual appointment reminder scan for admin ops', async () => {
    const processSpy = jest
      .spyOn(service, 'processAppointmentReminders')
      .mockResolvedValue({ checked: 5, sent: 2 });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-01-01T00:00:00.000Z').getTime());

    const result = await service.triggerAppointmentReminderScanByAdmin(ADMIN_USER);

    expect(processSpy).toHaveBeenCalled();
    expect(result).toEqual({
      checked: 5,
      sent: 2,
      triggeredBy: 'admin-user-1',
      triggeredAt: '2099-01-01T00:00:00.000Z',
    });
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'APPOINTMENT_REMINDER_MANUAL_SCAN',
        entityType: 'BOOKING',
        entityId: 'appointment-reminder-scan',
        actor: ADMIN_USER,
        metadata: expect.objectContaining({
          checked: 5,
          sent: 2,
          triggeredBy: 'admin-user-1',
        }),
      }),
    );
    processSpy.mockRestore();
    jest.useRealTimers();
  });

  it('returns latest manual reminder scan status from audit log', async () => {
    prismaMock.auditLog.findFirst.mockResolvedValue({
      actorUserId: 'admin-user-1',
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      metadata: {
        checked: 8,
        sent: 2,
        triggeredBy: 'admin-user-1',
        triggeredAt: '2099-01-01T00:00:00.000Z',
      },
    });

    const result = await service.getLastAppointmentReminderScanStatus();

    expect(prismaMock.auditLog.findFirst).toHaveBeenCalledWith({
      where: {
        action: 'APPOINTMENT_REMINDER_MANUAL_SCAN',
        entityType: 'BOOKING',
        entityId: 'appointment-reminder-scan',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        actorUserId: true,
        createdAt: true,
        metadata: true,
      },
    });
    expect(result).toEqual({
      found: true,
      lastScan: {
        checked: 8,
        sent: 2,
        triggeredBy: 'admin-user-1',
        triggeredAt: '2099-01-01T00:00:00.000Z',
      },
    });
  });

  it('returns found=false when no manual reminder scan exists', async () => {
    prismaMock.auditLog.findFirst.mockResolvedValue(null);

    const result = await service.getLastAppointmentReminderScanStatus();

    expect(result).toEqual({ found: false, lastScan: null });
  });
});
