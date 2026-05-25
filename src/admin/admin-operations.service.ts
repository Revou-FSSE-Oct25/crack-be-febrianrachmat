import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  ConsultationStatus,
  Prisma,
  TherapistVerificationStatus,
  TransactionStatus,
} from '@prisma/client';
import { buildCsv } from '../common/csv/csv.util';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_CSV_EXPORT_MAX_ROWS } from './admin-operations-export.constants';
import { AdminOperationsBookingsExportQueryDto } from './dto/admin-operations-bookings-export-query.dto';
import { AdminOperationsBookingsQueryDto } from './dto/admin-operations-bookings-query.dto';
import { AdminOperationsTransactionsExportQueryDto } from './dto/admin-operations-transactions-export-query.dto';
import { AdminOperationsTransactionsQueryDto } from './dto/admin-operations-transactions-query.dto';

const transactionInclude = {
  patient: {
    include: {
      user: { select: { fullName: true, email: true } },
    },
  },
  booking: {
    select: {
      id: true,
      appointmentType: true,
      appointmentDate: true,
      status: true,
    },
  },
  consultation: {
    select: {
      id: true,
      complaint: true,
      status: true,
    },
  },
} satisfies Prisma.TransactionInclude;

const bookingInclude = {
  patient: {
    include: {
      user: { select: { fullName: true, email: true } },
    },
  },
  physiotherapist: {
    include: {
      user: { select: { fullName: true } },
    },
  },
} satisfies Prisma.BookingInclude;

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getQueue() {
    const [
      pendingTransactions,
      pendingBookingPayments,
      pendingConsultationPayments,
      pendingPhysiotherapistVerifications,
      pendingBookings,
      consultationsAcceptedAwaitingPayment,
    ] = await Promise.all([
      this.prisma.transaction.count({
        where: { status: TransactionStatus.PENDING },
      }),
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.PENDING,
          bookingId: { not: null },
        },
      }),
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.PENDING,
          consultationId: { not: null },
        },
      }),
      this.prisma.physiotherapistProfile.count({
        where: { verificationStatus: TherapistVerificationStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),
      this.prisma.consultation.count({
        where: {
          status: ConsultationStatus.ACCEPTED,
          transactions: {
            none: { status: TransactionStatus.PAID },
          },
        },
      }),
    ]);

    const recentPendingTransactions = await this.prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: 5,
      include: transactionInclude,
    });

    return {
      counts: {
        pendingTransactions,
        pendingBookingPayments,
        pendingConsultationPayments,
        pendingPhysiotherapistVerifications,
        pendingBookings,
        consultationsAcceptedAwaitingPayment,
      },
      recentPendingTransactions: recentPendingTransactions.map((row) =>
        this.mapTransaction(row),
      ),
    };
  }

  async listTransactions(query: AdminOperationsTransactionsQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.TransactionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        include: transactionInclude,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((row) => this.mapTransaction(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async exportTransactionsCsv(
    query: AdminOperationsTransactionsExportQueryDto,
  ): Promise<{ csv: string; filename: string; rowCount: number }> {
    const where: Prisma.TransactionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const items = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_CSV_EXPORT_MAX_ROWS,
      include: transactionInclude,
    });

    const headers = [
      'id',
      'status',
      'amount',
      'paymentMethod',
      'hasPaymentProof',
      'paymentProofUrl',
      'referenceType',
      'bookingId',
      'consultationId',
      'patientId',
      'patientName',
      'patientEmail',
      'createdAt',
      'paidAt',
      'bookingStatus',
      'bookingAppointmentType',
      'bookingAppointmentDate',
      'consultationStatus',
      'consultationComplaint',
    ];

    const rows = items.map((row) => {
      const mapped = this.mapTransaction(row);
      return [
        mapped.id,
        mapped.status,
        mapped.amount,
        mapped.paymentMethod,
        mapped.hasPaymentProof,
        mapped.paymentProofUrl ?? '',
        mapped.referenceType,
        mapped.bookingId ?? '',
        mapped.consultationId ?? '',
        mapped.patient.id,
        mapped.patient.fullName,
        mapped.patient.email,
        mapped.createdAt,
        mapped.paidAt ?? '',
        mapped.booking?.status ?? '',
        mapped.booking?.appointmentType ?? '',
        mapped.booking?.appointmentDate ?? '',
        mapped.consultation?.status ?? '',
        mapped.consultation?.complaint ?? '',
      ];
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const statusSuffix = query.status ? `-${query.status.toLowerCase()}` : '';
    return {
      csv: buildCsv(headers, rows),
      filename: `transactions-export${statusSuffix}-${stamp}.csv`,
      rowCount: items.length,
    };
  }

  async exportBookingsCsv(
    query: AdminOperationsBookingsExportQueryDto,
  ): Promise<{ csv: string; filename: string; rowCount: number }> {
    const where: Prisma.BookingWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const items = await this.prisma.booking.findMany({
      where,
      orderBy: { appointmentDate: 'desc' },
      take: ADMIN_CSV_EXPORT_MAX_ROWS,
      include: bookingInclude,
    });

    const headers = [
      'id',
      'status',
      'appointmentType',
      'appointmentDate',
      'visitFeeSnapshot',
      'locationLabel',
      'notes',
      'createdAt',
      'patientId',
      'patientName',
      'patientEmail',
      'physiotherapistId',
      'physiotherapistName',
    ];

    const rows = items.map((row) => {
      const mapped = this.mapBooking(row);
      return [
        mapped.id,
        mapped.status,
        mapped.appointmentType,
        mapped.appointmentDate,
        mapped.visitFeeSnapshot,
        mapped.locationLabel,
        mapped.notes ?? '',
        mapped.createdAt,
        mapped.patient.id,
        mapped.patient.fullName,
        mapped.patient.email,
        mapped.physiotherapist.id,
        mapped.physiotherapist.fullName,
      ];
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const statusSuffix = query.status ? `-${query.status.toLowerCase()}` : '';
    return {
      csv: buildCsv(headers, rows),
      filename: `bookings-export${statusSuffix}-${stamp}.csv`,
      rowCount: items.length,
    };
  }

  async listBookings(query: AdminOperationsBookingsQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.BookingWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { appointmentDate: 'desc' },
        skip,
        take: query.limit,
        include: bookingInclude,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((row) => this.mapBooking(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  private mapTransaction(
    row: Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>,
  ) {
    const referenceType = row.bookingId
      ? ('BOOKING' as const)
      : row.consultationId
        ? ('CONSULTATION' as const)
        : ('UNKNOWN' as const);

    return {
      id: row.id,
      status: row.status,
      amount: row.amount.toString(),
      paymentMethod: row.paymentMethod,
      paymentProofUrl: row.paymentProofUrl,
      hasPaymentProof: Boolean(row.paymentProofUrl?.trim()),
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      referenceType,
      bookingId: row.bookingId,
      consultationId: row.consultationId,
      patient: {
        id: row.patientId,
        fullName: row.patient.user.fullName,
        email: row.patient.user.email,
      },
      booking: row.booking
        ? {
            id: row.booking.id,
            appointmentType: row.booking.appointmentType,
            appointmentDate: row.booking.appointmentDate.toISOString(),
            status: row.booking.status,
          }
        : null,
      consultation: row.consultation
        ? {
            id: row.consultation.id,
            complaint: row.consultation.complaint,
            status: row.consultation.status,
          }
        : null,
    };
  }

  private mapBooking(
    row: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>,
  ) {
    const locationLabel =
      row.appointmentType === 'HOME_VISIT'
        ? row.homeVisitAddress ?? 'Home visit'
        : row.clinicAddress ?? 'Klinik';

    return {
      id: row.id,
      status: row.status,
      appointmentType: row.appointmentType,
      appointmentDate: row.appointmentDate.toISOString(),
      visitFeeSnapshot: row.visitFeeSnapshot.toString(),
      locationLabel,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      patient: {
        id: row.patientId,
        fullName: row.patient.user.fullName,
        email: row.patient.user.email,
      },
      physiotherapist: {
        id: row.physiotherapistId,
        fullName: row.physiotherapist.user.fullName,
      },
    };
  }
}
