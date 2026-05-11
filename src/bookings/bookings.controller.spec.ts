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
    createTransaction: jest.fn(),
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
  const REQ = { user: PATIENT_USER };

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

    await controller.refund('tx-1', dto);

    expect(bookingsServiceMock.refundTransactionByAdmin).toHaveBeenCalledWith(
      'tx-1',
      dto,
    );
  });

  it('delegates mark paid by admin', async () => {
    bookingsServiceMock.markTransactionPaidByAdmin.mockResolvedValue({
      id: 'tx-1',
    });

    await controller.markPaidByAdmin('tx-1');

    expect(bookingsServiceMock.markTransactionPaidByAdmin).toHaveBeenCalledWith(
      'tx-1',
    );
  });
});
