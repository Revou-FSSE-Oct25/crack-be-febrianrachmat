import { UserRole } from '@prisma/client';
import { BookingsController } from './bookings.controller';

describe('BookingsController', () => {
  const bookingsServiceMock = {
    createConsultation: jest.fn(),
    listMyConsultations: jest.fn(),
    updateConsultationStatus: jest.fn(),
    createBooking: jest.fn(),
    listMyBookings: jest.fn(),
    updateBookingStatus: jest.fn(),
    rescheduleBooking: jest.fn(),
    createTransaction: jest.fn(),
    triggerAppointmentReminderScanByAdmin: jest.fn(),
    getLastAppointmentReminderScanStatus: jest.fn(),
    markTransactionPaidByAdmin: jest.fn(),
    refundTransactionByAdmin: jest.fn(),
    listTransactions: jest.fn(),
  };

  const controller = new BookingsController(bookingsServiceMock as never);
  const PATIENT_USER = {
    sub: 'patient-user-1',
    email: 'p@mail.com',
    role: UserRole.PATIENT,
  };
  const ADMIN_USER = {
    sub: 'admin-user-1',
    email: 'a@mail.com',
    role: UserRole.ADMIN,
  };
  const REQ = { user: PATIENT_USER };
  const ADMIN_REQ = { user: ADMIN_USER };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates createConsultation with req.user and dto', async () => {
    const dto = { physiotherapistId: 'therapist-1', complaint: 'Back pain' };
    bookingsServiceMock.createConsultation.mockResolvedValue({ id: 'consult-1' });

    await controller.createConsultation(REQ as never, dto);

    expect(bookingsServiceMock.createConsultation).toHaveBeenCalledWith(
      PATIENT_USER,
      dto,
    );
  });

  it('delegates createBooking with req.user and dto', async () => {
    const dto = {
      physiotherapistId: 'therapist-1',
      appointmentType: 'CLINIC_VISIT',
      appointmentDate: '2099-06-01T09:00:00.000Z',
      clinicAddress: 'Jl. Klinik Utama 123',
    };
    bookingsServiceMock.createBooking.mockResolvedValue({ id: 'booking-1' });

    await controller.createBooking(REQ as never, dto as never);

    expect(bookingsServiceMock.createBooking).toHaveBeenCalledWith(
      PATIENT_USER,
      dto,
    );
  });

  it('delegates updateBookingStatus with req.user, bookingId, and dto', async () => {
    const dto = { status: 'CANCELLED' };
    bookingsServiceMock.updateBookingStatus.mockResolvedValue({ id: 'booking-1' });

    await controller.updateBookingStatus(REQ as never, 'booking-1', dto as never);

    expect(bookingsServiceMock.updateBookingStatus).toHaveBeenCalledWith(
      PATIENT_USER,
      'booking-1',
      dto,
    );
  });

  it('delegates rescheduleBooking with req.user, bookingId, and dto', async () => {
    const dto = { appointmentDate: '2099-06-03T09:00:00.000Z' };
    bookingsServiceMock.rescheduleBooking.mockResolvedValue({ id: 'booking-1' });

    await controller.rescheduleBooking(REQ as never, 'booking-1', dto as never);

    expect(bookingsServiceMock.rescheduleBooking).toHaveBeenCalledWith(
      PATIENT_USER,
      'booking-1',
      dto,
    );
  });

  it('delegates listTransactions with req.user and pagination query', async () => {
    const query = { page: 2, limit: 5 };
    bookingsServiceMock.listTransactions.mockResolvedValue([{ id: 'tx-1' }]);

    await controller.listTransactions(REQ as never, query);

    expect(bookingsServiceMock.listTransactions).toHaveBeenCalledWith(
      PATIENT_USER,
      query,
    );
  });

  it('delegates refund to admin refund service method', async () => {
    const dto = { reason: 'Duplicate payment' };
    bookingsServiceMock.refundTransactionByAdmin.mockResolvedValue({ id: 'tx-1' });

    await controller.refund(ADMIN_REQ as never, 'tx-1', dto);

    expect(bookingsServiceMock.refundTransactionByAdmin).toHaveBeenCalledWith(
      'tx-1',
      dto,
      ADMIN_USER,
    );
  });

  it('delegates mark paid by admin', async () => {
    bookingsServiceMock.markTransactionPaidByAdmin.mockResolvedValue({
      id: 'tx-1',
    });

    await controller.markPaidByAdmin(ADMIN_REQ as never, 'tx-1');

    expect(bookingsServiceMock.markTransactionPaidByAdmin).toHaveBeenCalledWith(
      'tx-1',
      ADMIN_USER,
    );
  });

  it('delegates admin reminder scan trigger', async () => {
    bookingsServiceMock.triggerAppointmentReminderScanByAdmin.mockResolvedValue({
      checked: 3,
      sent: 2,
      triggeredBy: 'admin-user-1',
      triggeredAt: '2099-01-01T00:00:00.000Z',
    });

    await controller.triggerAppointmentReminderScan(ADMIN_REQ as never);

    expect(
      bookingsServiceMock.triggerAppointmentReminderScanByAdmin,
    ).toHaveBeenCalledWith(ADMIN_USER);
  });

  it('delegates latest reminder scan status read', async () => {
    bookingsServiceMock.getLastAppointmentReminderScanStatus.mockResolvedValue({
      found: true,
      lastScan: {
        checked: 3,
        sent: 1,
        triggeredBy: 'admin-user-1',
        triggeredAt: '2099-01-01T00:00:00.000Z',
      },
    });

    await controller.getLastAppointmentReminderScanStatus();

    expect(
      bookingsServiceMock.getLastAppointmentReminderScanStatus,
    ).toHaveBeenCalled();
  });
});
