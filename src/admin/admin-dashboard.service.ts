import { Injectable } from '@nestjs/common';
import {
  TherapistVerificationStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalUsers,
      totalPatients,
      totalPhysiotherapists,
      pendingPhysiotherapistVerifications,
      approvedPhysiotherapists,
      totalBookings,
      bookingByStatus,
      transactionByStatus,
      totalRevenuePaid,
      totalRefundAmount,
      totalReviews,
      hiddenReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.PATIENT } }),
      this.prisma.user.count({ where: { role: UserRole.PHYSIOTHERAPIST } }),
      this.prisma.physiotherapistProfile.count({
        where: { verificationStatus: TherapistVerificationStatus.PENDING },
      }),
      this.prisma.physiotherapistProfile.count({
        where: { verificationStatus: TherapistVerificationStatus.APPROVED },
      }),
      this.prisma.booking.count(),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.REFUNDED },
        _sum: { amount: true },
      }),
      this.prisma.review.count(),
      this.prisma.review.count({ where: { isHidden: true } }),
    ]);

    return {
      users: {
        total: totalUsers,
        patients: totalPatients,
        physiotherapists: totalPhysiotherapists,
      },
      physiotherapistVerification: {
        pending: pendingPhysiotherapistVerifications,
        approved: approvedPhysiotherapists,
      },
      bookings: {
        total: totalBookings,
        byStatus: bookingByStatus,
      },
      transactions: {
        byStatus: transactionByStatus,
        totalRevenuePaid: totalRevenuePaid._sum.amount ?? 0,
        totalRefundAmount: totalRefundAmount._sum.amount ?? 0,
      },
      reviews: {
        total: totalReviews,
        hidden: hiddenReviews,
      },
    };
  }
}
