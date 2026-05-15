import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentType,
  BookingStatus,
  ConsultationSlaTier,
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
import { consultationSlaWindowMinutes } from './consultation-sla.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

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

  /**
   * Lifecycle of a paid online consultation. `IN_PROGRESS` is reserved for the
   * payment-confirmation pathway (admin marks transaction PAID) and is NOT a
   * value a patient/therapist can set directly via the status endpoint.
   */
  private readonly allowedConsultationTransitions: Record<
    ConsultationStatus,
    ConsultationStatus[]
  > = {
    [ConsultationStatus.REQUESTED]: [
      ConsultationStatus.ACCEPTED,
      ConsultationStatus.CANCELLED,
    ],
    [ConsultationStatus.ACCEPTED]: [
      ConsultationStatus.IN_PROGRESS,
      ConsultationStatus.CANCELLED,
    ],
    [ConsultationStatus.IN_PROGRESS]: [
      ConsultationStatus.COMPLETED,
      ConsultationStatus.CANCELLED,
    ],
    [ConsultationStatus.COMPLETED]: [],
    [ConsultationStatus.CANCELLED]: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
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

    const slaTier = dto.slaTier ?? ConsultationSlaTier.STANDARD;
    const now = new Date();
    if (slaTier === ConsultationSlaTier.FAST_ONLINE) {
      if (!therapist.onlineUntil || therapist.onlineUntil <= now) {
        throw new BadRequestException(
          'Respons cepat hanya tersedia saat terapis sedang online (heartbeat aktif). Buka daftar fisioterapis, pastikan badge Online, lalu ajukan lagi.',
        );
      }
    }

    // Snapshot the therapist's current consultationFee into the consultation
    // so the price the patient sees + pays is locked in, even if the therapist
    // later updates their profile fee.
    const consultation = await this.prisma.consultation.create({
      data: {
        patientId: patientProfile.id,
        physiotherapistId: therapist.id,
        complaint: dto.complaint,
        feeSnapshot: therapist.consultationFee,
        slaTier,
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
      'A patient submitted a new consultation request for you. Please accept to let them proceed to payment.',
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

    // IN_PROGRESS is only set automatically when admin confirms a paid
    // transaction. Disallow setting it through this generic endpoint to
    // prevent bypassing the payment requirement.
    if (
      dto.status === ConsultationStatus.IN_PROGRESS &&
      authUser.role !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'IN_PROGRESS is set automatically once the transaction is paid; not assignable manually.',
      );
    }

    this.assertValidConsultationTransition(consultation.status, dto.status);

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!therapist || therapist.id !== consultation.physiotherapistId) {
        throw new ForbiddenException('You can only update your own consultations.');
      }
      // Therapist can accept a fresh request, mark a paid session complete,
      // or cancel before payment. They cannot directly set IN_PROGRESS.
      const allowedForTherapist: ConsultationStatus[] = [
        ConsultationStatus.ACCEPTED,
        ConsultationStatus.COMPLETED,
        ConsultationStatus.CANCELLED,
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
      // Patient can cancel anytime before completion, or mark the active
      // session complete once it's already in progress.
      if (
        dto.status === ConsultationStatus.COMPLETED &&
        consultation.status !== ConsultationStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          'Patient can only mark a consultation completed once it is IN_PROGRESS.',
        );
      }
      const allowedForPatient: ConsultationStatus[] = [
        ConsultationStatus.CANCELLED,
        ConsultationStatus.COMPLETED,
      ];
      if (!allowedForPatient.includes(dto.status)) {
        throw new BadRequestException(
          'Patient can only cancel or complete a consultation.',
        );
      }
    } else if (authUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Unauthorized role.');
    }

    const updated = await this.prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: dto.status,
        acceptedAt:
          dto.status === ConsultationStatus.ACCEPTED && !consultation.acceptedAt
            ? new Date()
            : undefined,
        completedAt:
          dto.status === ConsultationStatus.COMPLETED
            ? new Date()
            : undefined,
      },
    });

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { id: consultation.patientId },
        select: { userId: true },
      });
      if (patient) {
        const message =
          dto.status === ConsultationStatus.ACCEPTED
            ? `Your consultation has been accepted. Please proceed to payment (Rp ${consultation.feeSnapshot.toString()}) to start the session.`
            : `Your consultation status is now ${dto.status}.`;
        await this.safeNotify(
          patient.userId,
          'Consultation Status Updated',
          message,
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
          dto.status === ConsultationStatus.COMPLETED
            ? 'Consultation Completed'
            : 'Consultation Cancelled',
          dto.status === ConsultationStatus.COMPLETED
            ? 'A patient marked the consultation as completed.'
            : 'A patient cancelled a consultation request.',
        );
      }
    }

    return updated;
  }

  private assertValidConsultationTransition(
    currentStatus: ConsultationStatus,
    nextStatus: ConsultationStatus,
  ): void {
    if (currentStatus === nextStatus) {
      throw new BadRequestException(
        `Consultation status is already ${currentStatus}.`,
      );
    }
    const allowed = this.allowedConsultationTransitions[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid consultation status transition from ${currentStatus} to ${nextStatus}.`,
      );
    }
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
      if (consultation.status === ConsultationStatus.CANCELLED) {
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

    const visitFeeSnapshot = new Prisma.Decimal(therapist.visitFee.toString());

    const booking = await this.prisma.$transaction(async (tx) => {
      if (dto.slotId) {
        // Atomic claim: only one concurrent request may flip isAvailable true → false.
        const claimed = await tx.availabilitySlot.updateMany({
          where: {
            id: dto.slotId,
            physiotherapistId: dto.physiotherapistId,
            isAvailable: true,
          },
          data: { isAvailable: false },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Selected slot is no longer available. Please choose another time.',
          );
        }
      }

      return tx.booking.create({
        data: {
          consultationId: dto.consultationId,
          patientId: patient.id,
          physiotherapistId: dto.physiotherapistId,
          slotId: dto.slotId,
          appointmentType: dto.appointmentType,
          appointmentDate: resolvedAppointmentDate,
          visitFeeSnapshot,
          clinicAddress: dto.clinicAddress,
          homeVisitAddress: dto.homeVisitAddress,
          notes: dto.notes,
          status: BookingStatus.PENDING,
        },
      });
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

    // DTO already validates "at least one of bookingId / consultationId" but
    // we still enforce XOR here so service-layer callers get the same guard.
    if (Boolean(dto.bookingId) === Boolean(dto.consultationId)) {
      throw new BadRequestException(
        'Provide exactly one of bookingId or consultationId for a transaction.',
      );
    }

    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking || booking.patientId !== patient.id) {
        throw new BadRequestException('Booking not found for current patient.');
      }

      const existingBookingTx = await this.prisma.transaction.findFirst({
        where: {
          bookingId: booking.id,
          status: {
            in: [TransactionStatus.PENDING, TransactionStatus.PAID],
          },
        },
      });
      if (existingBookingTx) {
        throw new BadRequestException(
          'A pending or paid transaction already exists for this booking.',
        );
      }

      const amount = new Prisma.Decimal(booking.visitFeeSnapshot.toString());
      return this.prisma.transaction.create({
        data: {
          bookingId: booking.id,
          patientId: patient.id,
          amount,
          paymentMethod: dto.paymentMethod,
          status: TransactionStatus.PENDING,
        },
      });
    }

    // Consultation transaction path: only allowed once the therapist has
    // ACCEPTED the request. This is what gates "pay-first" and ensures the
    // patient never pays for a session the therapist never agreed to take.
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: dto.consultationId },
    });
    if (!consultation || consultation.patientId !== patient.id) {
      throw new BadRequestException(
        'Consultation not found for current patient.',
      );
    }
    if (consultation.status !== ConsultationStatus.ACCEPTED) {
      throw new BadRequestException(
        `Consultation must be ACCEPTED before payment (current status: ${consultation.status}).`,
      );
    }

    // Block duplicate pending/paid transactions on the same consultation.
    const existing = await this.prisma.transaction.findFirst({
      where: {
        consultationId: consultation.id,
        status: {
          in: [TransactionStatus.PENDING, TransactionStatus.PAID],
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A pending or paid transaction already exists for this consultation.',
      );
    }

    const amount = new Prisma.Decimal(consultation.feeSnapshot.toString());
    return this.prisma.transaction.create({
      data: {
        consultationId: consultation.id,
        patientId: patient.id,
        amount,
        paymentMethod: dto.paymentMethod,
        status: TransactionStatus.PENDING,
      },
    });
  }

  /**
   * Konfirmasi pembayaran dummy — hanya admin (pasien tidak boleh self-confirm).
   *
   * Side-effect penting (Phase 1): kalau transaksi tertaut ke sebuah
   * Consultation, status consultation otomatis dipindah dari ACCEPTED →
   * IN_PROGRESS sehingga chat ter-unlock. Ini fondasi flow pay-first.
   */
  async markTransactionPaidByAdmin(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { consultation: { include: { physiotherapist: true } } },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Only pending transaction can be marked as paid.');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.PAID, paidAt: now },
      });

      if (transaction.consultationId && transaction.consultation) {
        if (
          transaction.consultation.status === ConsultationStatus.ACCEPTED
        ) {
          await tx.consultation.update({
            where: { id: transaction.consultationId },
            data: {
              status: ConsultationStatus.IN_PROGRESS,
              startedAt: now,
            },
          });
        }
      }

      return updated;
    });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: transaction.patientId },
      select: { userId: true },
    });
    if (patient) {
      await this.safeNotify(
        patient.userId,
        'Payment Confirmed',
        transaction.consultationId
          ? 'Pembayaran konsultasi dikonfirmasi. Sesi chat sekarang aktif — silakan mulai.'
          : 'Your payment has been confirmed by admin. Transaction is now PAID.',
      );
    }
    if (transaction.consultationId && transaction.consultation) {
      await this.safeNotify(
        transaction.consultation.physiotherapist.userId,
        'Consultation Ready',
        'Pasien telah membayar. Sesi konsultasi sekarang aktif, silakan mulai chat.',
      );
    }

    return updated;
  }

  async refundTransactionByAdmin(
    transactionId: string,
    dto: RefundTransactionDto,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        consultation: {
          include: {
            physiotherapist: { select: { userId: true } },
          },
        },
      },
    });
    if (!transaction) throw new NotFoundException('Transaction not found.');
    if (transaction.status !== TransactionStatus.PAID) {
      throw new BadRequestException('Only paid transaction can be refunded.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.REFUNDED,
          refundedAt: new Date(),
          refundReason: dto.reason,
        },
      });

      // Refunding a consultation transaction implicitly cancels the session
      // so the chat gating immediately closes.
      if (transaction.consultationId && transaction.consultation) {
        if (
          transaction.consultation.status === ConsultationStatus.IN_PROGRESS ||
          transaction.consultation.status === ConsultationStatus.ACCEPTED
        ) {
          await tx.consultation.update({
            where: { id: transaction.consultationId },
            data: { status: ConsultationStatus.CANCELLED },
          });
        }
      }

      return updated;
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

    const therapistUserId =
      transaction.consultation?.physiotherapist?.userId;
    if (therapistUserId) {
      await this.safeNotify(
        therapistUserId,
        'Transaction Refunded',
        `Transaksi konsultasi dikembalikan. Alasan: ${dto.reason}`,
      );
    }

    return updated;
  }

  /**
   * Scan active paid consultations: if the therapist never sent any chat
   * message since `startedAt` and the SLA window has passed, refund the PAID
   * transaction (same DB path as admin refund).
   */
  async processConsultationSlaTimeouts(): Promise<{
    checked: number;
    refunded: number;
  }> {
    const fastRaw = this.configService.get<string>('CONSULTATION_SLA_FAST_MINUTES');
    const stdRaw = this.configService.get<string>('CONSULTATION_SLA_STANDARD_MINUTES');
    const fastMinutes = Math.max(1, Number(fastRaw) || 10);
    const standardMinutes = Math.max(1, Number(stdRaw) || 24 * 60);
    const now = new Date();

    const sessions = await this.prisma.consultation.findMany({
      where: {
        status: ConsultationStatus.IN_PROGRESS,
        startedAt: { not: null },
      },
      include: {
        physiotherapist: { select: { userId: true } },
        conversation: { select: { id: true } },
      },
    });

    let refunded = 0;
    for (const c of sessions) {
      const startedAt = c.startedAt as Date;
      const slaMinutes = consultationSlaWindowMinutes(
        c.slaTier,
        fastMinutes,
        standardMinutes,
      );
      const deadline = new Date(startedAt.getTime() + slaMinutes * 60_000);
      if (now <= deadline) {
        continue;
      }

      const convId = c.conversation?.id;
      let therapistReplied = false;
      if (convId) {
        const n = await this.prisma.message.count({
          where: {
            conversationId: convId,
            senderId: c.physiotherapist.userId,
            createdAt: { gte: startedAt },
          },
        });
        therapistReplied = n > 0;
      }
      if (therapistReplied) {
        continue;
      }

      const tx = await this.prisma.transaction.findFirst({
        where: {
          consultationId: c.id,
          status: TransactionStatus.PAID,
        },
      });
      if (!tx) {
        continue;
      }

      const label =
        c.slaTier === ConsultationSlaTier.FAST_ONLINE
          ? `${slaMinutes} menit (respons cepat)`
          : `${Math.round(slaMinutes / 60)} jam (standar)`;

      try {
        await this.refundTransactionByAdmin(tx.id, {
          reason: `Pengembalian otomatis: tidak ada balasan terapis dalam batas ${label}.`,
        });
        refunded += 1;
      } catch (err) {
        this.logger.warn(
          `SLA refund skipped for consultation ${c.id} / tx ${tx.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { checked: sessions.length, refunded };
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
