import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';

describe('BookingsService booking transition guard', () => {
  const prismaMock = {} as never;
  const notificationsMock = {} as never;
  const service = new BookingsService(prismaMock, notificationsMock);

  it('allows valid transition PENDING -> CONFIRMED', () => {
    expect(() =>
      (
        service as unknown as {
          assertValidBookingTransition: (
            currentStatus: BookingStatus,
            nextStatus: BookingStatus,
          ) => void;
        }
      ).assertValidBookingTransition(
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
      ),
    ).not.toThrow();
  });

  it('rejects skipped transition PENDING -> COMPLETED', () => {
    expect(() =>
      (
        service as unknown as {
          assertValidBookingTransition: (
            currentStatus: BookingStatus,
            nextStatus: BookingStatus,
          ) => void;
        }
      ).assertValidBookingTransition(
        BookingStatus.PENDING,
        BookingStatus.COMPLETED,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects no-op transition CONFIRMED -> CONFIRMED', () => {
    expect(() =>
      (
        service as unknown as {
          assertValidBookingTransition: (
            currentStatus: BookingStatus,
            nextStatus: BookingStatus,
          ) => void;
        }
      ).assertValidBookingTransition(
        BookingStatus.CONFIRMED,
        BookingStatus.CONFIRMED,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects cancellation from COMPLETED', () => {
    expect(() =>
      (
        service as unknown as {
          assertValidBookingTransition: (
            currentStatus: BookingStatus,
            nextStatus: BookingStatus,
          ) => void;
        }
      ).assertValidBookingTransition(
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ),
    ).toThrow(BadRequestException);
  });
});
