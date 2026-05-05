import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentType,
  BookingStatus,
  ConsultationStatus,
  Prisma,
  TherapistVerificationStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

@Injectable()
export class BookingsService {
  private readonly allowedBookingTransitions: Record<
    BookingStatus,
    BookingStatus[]
  > = {
    [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
    [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    [BookingStatus.COMPLETED]: [],
    [BookingStatus.CANCELLED]: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createConsultation(authUser: AuthUser, dto: CreateConsultationDto) {
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patientProfile) {
      throw new BadRequestException('Patient profile not found.');
    }

    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: dto.physiotherapistId },
    });
    if (!therapist) {
      throw new NotFoundException('Physiotherapist not found.');
    }
    if (therapist.verificationStatus !== TherapistVerificationStatus.APPROVED) {
      throw new BadRequestException('Physiotherapist is not approved yet.');
    }

    const consultation = await this.prisma.consultation.create({
      data: {
        patientId: patientProfile.id,
        physiotherapistId: therapist.id,
        complaint: dto.complaint,
      },
      include: {
        patient: { include: { user: { select: { fullName: true, email: true } } } },
        physiotherapist: {
          include: { user: { select: { fullName: true, email: true } }, category: true },
        },
      },
    });

    await this.safeNotify(
      therapist.userId,
      'New Consultation Request',
      'A patient submitted a new consultation request for you.',
    );

    return consultation;
  }

  async listMyConsultations(authUser: AuthUser, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient) {
        throw new BadRequestException('Patient profile not found.');
      }
      return this.prisma.consultation.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    }

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!therapist) {
        throw new BadRequestException('Physiotherapist profile not found.');
      }
      return this.prisma.consultation.findMany({
        where: { physiotherapistId: therapist.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    }

    return this.prisma.consultation.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async updateConsultationStatus(
    authUser: AuthUser,
    consultationId: string,
    dto: UpdateConsultationStatusDto,
  ) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { patient: true, physiotherapist: true },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found.');
    }

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!therapist || therapist.id !== consultation.physiotherapistId) {
        throw new ForbiddenException('You can only update your own consultations.');
      }
      const allowedForTherapist: ConsultationStatus[] = [
        ConsultationStatus.ACCEPTED,
        ConsultationStatus.REJECTED,
        ConsultationStatus.COMPLETED,
      ];
      if (!allowedForTherapist.includes(dto.status)) {
        throw new BadRequestException('Invalid status for physiotherapist.');
      }
    } else if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient || patient.id !== consultation.patientId) {
        throw new ForbiddenException('You can only update your own consultations.');
      }
      if (dto.status !== ConsultationStatus.CANCELLED) {
        throw new BadRequestException('Patient can only cancel consultation.');
      }
    } else if (authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Unauthorized role.');
    }

    const updated = await this.prisma.consultation.update({
      where: { id: consultationId },
      data: { status: dto.status },
    });

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { id: consultation.patientId },
        select: { userId: true },
      });
      if (patient) {
        await this.safeNotify(
          patient.userId,
          'Consultation Status Updated',
          `Your consultation status is now ${dto.status}.`,
        );
      }
    } else if (authUser.role === UserRole.PATIENT) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { id: consultation.physiotherapistId },
        select: { userId: true },
      });
      if (therapist) {
        await this.safeNotify(
          therapist.userId,
          'Consultation Cancelled',
          'A patient cancelled a consultation request.',
        );
      }
    }

    return updated;
  }

  async createBooking(authUser: AuthUser, dto: CreateBookingDto) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patient) {
      throw new BadRequestException('Patient profile not found.');
    }

    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: dto.physiotherapistId },
    });
    if (!therapist) {
      throw new NotFoundException('Physiotherapist not found.');
    }
    if (therapist.verificationStatus !== TherapistVerificationStatus.APPROVED) {
      throw new BadRequestException('Physiotherapist is not approved yet.');
    }

    if (dto.appointmentType === AppointmentType.CLINIC_VISIT && !dto.clinicAddress) {
      throw new BadRequestException('clinicAddress is required for CLINIC_VISIT.');
    }
    if (dto.appointmentType === AppointmentType.HOME_VISIT && !dto.homeVisitAddress) {
      throw new BadRequestException('homeVisitAddress is required for HOME_VISIT.');
    }

    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findUnique({
        where: { id: dto.consultationId },
      });
      if (!consultation || consultation.patientId !== patient.id) {
        throw new BadRequestException('consultationId is invalid for this patient.');
      }
      if (consultation.physiotherapistId !== dto.physiotherapistId) {
        throw new BadRequestException(
          'consultationId does not match the selected physiotherapist.',
        );
      }
      if (
        consultation.status === ConsultationStatus.REJECTED ||
        consultation.status === ConsultationStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot create booking from consultation with status ${consultation.status}.`,
        );
      }
    }

    let appointmentDate = dto.appointmentDate
      ? new Date(dto.appointmentDate)
      : undefined;
    if (appointmentDate && Number.isNaN(appointmentDate.getTime())) {
      throw new BadRequestException('appointmentDate is invalid.');
    }

    if (dto.slotId) {
      const slot = await this.prisma.availabilitySlot.findUnique({
        where: { id: dto.slotId },
      });
      if (!slot || slot.physiotherapistId !== dto.physiotherapistId) {
        throw new BadRequestException('slotId is invalid for selected physiotherapist.');
      }
      if (!slot.isAvailable) {
        throw new BadRequestException('Selected slot is no longer available.');
      }
      if (slot.endTime <= new Date()) {
        throw new BadRequestException('Selected slot has already passed.');
      }
      if (
        appointmentDate &&
        appointmentDate.getTime() !== slot.startTime.getTime()
      ) {
        throw new BadRequestException(
          'appointmentDate must equal slot startTime when slotId is provided.',
        );
      }
      appointmentDate = slot.startTime;
    } else if (!appointmentDate) {
      throw new BadRequestException(
        'appointmentDate is required when slotId is not provided.',
      );
    }
    const resolvedAppointmentDate = appointmentDate as Date;

    const booking = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          consultationId: dto.consultationId,
          patientId: patient.id,
          physiotherapistId: dto.physiotherapistId,
          slotId: dto.slotId,
          appointmentType: dto.appointmentType,
          appointmentDate: resolvedAppointmentDate,
          clinicAddress: dto.clinicAddress,
          homeVisitAddress: dto.homeVisitAddress,
          notes: dto.notes,
          status: BookingStatus.PENDING,
        },
      });

      if (dto.slotId) {
        await tx.availabilitySlot.update({
          where: { id: dto.slotId },
          data: { isAvailable: false },
        });
      }

      return booking;
    });

    await this.safeNotify(
      therapist.userId,
      'New Booking Request',
      'A patient created a new booking request.',
    );

    return booking;
  }

  async listMyBookings(authUser: AuthUser, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient) throw new BadRequestException('Patient profile not found.');
      return this.prisma.booking.findMany({
        where: { patientId: patient.id },
        orderBy: { appointmentDate: 'desc' },
        skip,
        take,
      });
    }
    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!therapist) throw new BadRequestException('Physiotherapist profile not found.');
      return this.prisma.booking.findMany({
        where: { physiotherapistId: therapist.id },
        orderBy: { appointmentDate: 'desc' },
        skip,
        take,
      });
    }
    return this.prisma.booking.findMany({
      orderBy: { appointmentDate: 'desc' },
      skip,
      take,
    });
  }

  async updateBookingStatus(
    authUser: AuthUser,
    bookingId: string,
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    this.assertValidBookingTransition(booking.status, dto.status);

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!therapist || therapist.id !== booking.physiotherapistId) {
        throw new ForbiddenException('You can only update your own bookings.');
      }
      const allowed: BookingStatus[] = [
        BookingStatus.CONFIRMED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.COMPLETED,
      ];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException('Invalid status for physiotherapist.');
      }
    } else if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient || patient.id !== booking.patientId) {
        throw new ForbiddenException('You can only update your own bookings.');
      }
      if (dto.status !== BookingStatus.CANCELLED) {
        throw new BadRequestException('Patient can only cancel booking.');
      }
    } else if (authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Unauthorized role.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: dto.status },
      });

      // If booking gets cancelled, release slot back to available.
      if (dto.status === BookingStatus.CANCELLED && booking.slotId) {
        await tx.availabilitySlot.update({
          where: { id: booking.slotId },
          data: { isAvailable: true },
        });
      }
      return updated;
    });

    if (
      authUser.role === UserRole.PHYSIOTHERAPIST ||
      authUser.role === UserRole.ADMIN
    ) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { id: booking.patientId },
        select: { userId: true },
      });
      if (patient) {
        await this.safeNotify(
          patient.userId,
          'Booking Status Updated',
          `Your booking status is now ${dto.status}.`,
        );
      }
    }

    return updated;
  }

  private assertValidBookingTransition(
    currentStatus: BookingStatus,
    nextStatus: BookingStatus,
  ): void {
    if (currentStatus === nextStatus) {
      throw new BadRequestException(
        `Booking status is already ${currentStatus}.`,
      );
    }

    const allowedNext = this.allowedBookingTransitions[currentStatus] ?? [];
    if (!allowedNext.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid booking status transition from ${currentStatus} to ${nextStatus}.`,
      );
    }
  }

  async createTransaction(authUser: AuthUser, dto: CreateTransactionDto) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patient) throw new BadRequestException('Patient profile not found.');

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking || booking.patientId !== patient.id) {
      throw new BadRequestException('Booking not found for current patient.');
    }

    return this.prisma.transaction.create({
      data: {
        bookingId: booking.id,
        patientId: patient.id,
        amount: new Prisma.Decimal(dto.amount),
        paymentMethod: dto.paymentMethod,
        status: TransactionStatus.PENDING,
      },
    });
  }

  async markTransactionPaid(authUser: AuthUser, transactionId: string) {
    if (authUser.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patient can mark payment.');
    }
    const patient = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patient) throw new BadRequestException('Patient profile not found.');

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction || transaction.patientId !== patient.id) {
      throw new NotFoundException('Transaction not found.');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Only pending transaction can be marked as paid.');
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.PAID, paidAt: new Date() },
    });

    await this.safeNotify(
      authUser.sub,
      'Payment Successful',
      'Your transaction has been marked as PAID.',
    );

    return updated;
  }

  async refundTransactionByAdmin(
    transactionId: string,
    dto: RefundTransactionDto,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found.');
    if (transaction.status !== TransactionStatus.PAID) {
      throw new BadRequestException('Only paid transaction can be refunded.');
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.REFUNDED,
        refundedAt: new Date(),
        refundReason: dto.reason,
      },
    });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: transaction.patientId },
      select: { userId: true },
    });
    if (patient) {
      await this.safeNotify(
        patient.userId,
        'Transaction Refunded',
        `Your transaction was refunded. Reason: ${dto.reason}`,
      );
    }

    return updated;
  }

  async listTransactions(authUser: AuthUser, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient) throw new BadRequestException('Patient profile not found.');
      return this.prisma.transaction.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    }

    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  private async safeNotify(
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createSystemNotification(userId, title, body);
    } catch {
      // Notification failures should not break core transaction flow.
    }
  }
}
