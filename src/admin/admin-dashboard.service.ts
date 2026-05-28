import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  TherapistVerificationStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDayLabels,
  clampAnalyticsDays,
  countByDay,
  startOfUtcDay,
  sumMoneyByDay,
} from './admin-dashboard.helpers';

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
      totalConsultations,
      consultationByStatus,
      transactionByStatus,
      totalRevenuePaid,
      totalRefundAmount,
      totalReviews,
      hiddenReviews,
      visibleReviewAgg,
      auditLogTotal,
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
      this.prisma.consultation.count(),
      this.prisma.consultation.groupBy({
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
      this.prisma.review.aggregate({
        where: { isHidden: false },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.auditLog.count(),
    ]);

    const [reviewsFromBooking, reviewsFromConsultation, ratingGroups] =
      await Promise.all([
        this.prisma.review.count({
          where: {
            isHidden: false,
            consultationId: null,
            bookingId: { not: null },
          },
        }),
        this.prisma.review.count({
          where: { isHidden: false, consultationId: { not: null } },
        }),
        this.prisma.review.groupBy({
          by: ['rating'],
          where: { isHidden: false },
          _count: { _all: true },
        }),
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
      consultations: {
        total: totalConsultations,
        byStatus: consultationByStatus,
      },
      transactions: {
        byStatus: transactionByStatus,
        totalRevenuePaid: totalRevenuePaid._sum.amount ?? 0,
        totalRefundAmount: totalRefundAmount._sum.amount ?? 0,
      },
      reviews: {
        total: totalReviews,
        hidden: hiddenReviews,
        visible: visibleReviewAgg._count._all,
        averageRating: visibleReviewAgg._avg.rating ?? null,
        bySource: {
          booking: reviewsFromBooking,
          consultation: reviewsFromConsultation,
        },
        ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({
          rating,
          count:
            ratingGroups.find((g) => g.rating === rating)?._count._all ?? 0,
        })),
      },
      auditLogs: {
        total: auditLogTotal,
      },
    };
  }

  async getAnalytics(daysInput?: number) {
    const periodDays = clampAnalyticsDays(daysInput);
    const since = startOfUtcDay(periodDays - 1);
    const dayLabels = buildDayLabels(periodDays);

    const now = new Date();
    const [
      usersInPeriod,
      bookingsInPeriod,
      consultationsInPeriod,
      paidTxInPeriod,
      auditInPeriod,
      ratingGroups,
      reviewsFromBookingCount,
      reviewsFromConsultationCount,
      paidBookingAgg,
      paidConsultationAgg,
      topReviewGroups,
      completedBookingsInPeriod,
      cancelledBookingsInPeriod,
      noShowBookingsInPeriod,
      repeatPatientRaw,
      topPhysioByCompletedBookings,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.consultation.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          status: TransactionStatus.PAID,
          paidAt: { gte: since },
        },
        select: { paidAt: true, amount: true, bookingId: true, consultationId: true },
      }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { isHidden: false },
        _count: { _all: true },
      }),
      this.prisma.review.count({
        where: {
          isHidden: false,
          consultationId: null,
          bookingId: { not: null },
        },
      }),
      this.prisma.review.count({
        where: { isHidden: false, consultationId: { not: null } },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.PAID, bookingId: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.PAID, consultationId: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['physiotherapistId'],
        where: { isHidden: false },
        _avg: { rating: true },
        _count: { _all: true },
        orderBy: { _avg: { rating: 'desc' } },
        take: 5,
      }),
      this.prisma.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          appointmentDate: { gte: since },
        },
        select: { appointmentDate: true },
      }),
      this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CANCELLED,
          appointmentDate: { gte: since },
        },
        select: { appointmentDate: true },
      }),
      this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          appointmentDate: { gte: since, lt: now },
        },
        select: { appointmentDate: true },
      }),
      this.prisma.booking.groupBy({
        by: ['patientId'],
        where: {
          status: BookingStatus.COMPLETED,
          appointmentDate: { gte: since },
        },
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['physiotherapistId'],
        where: {
          status: BookingStatus.COMPLETED,
          appointmentDate: { gte: since },
        },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 5,
      }),
    ]);

    const paidRows = paidTxInPeriod
      .filter((tx) => tx.paidAt != null)
      .map((tx) => ({
        createdAt: tx.paidAt as Date,
        amount: tx.amount,
      }));

    const completedRows = completedBookingsInPeriod.map((row) => ({
      createdAt: row.appointmentDate,
    }));
    const cancelledRows = cancelledBookingsInPeriod.map((row) => ({
      createdAt: row.appointmentDate,
    }));
    const noShowRows = noShowBookingsInPeriod.map((row) => ({
      createdAt: row.appointmentDate,
    }));

    const completedByDay = countByDay(completedRows, dayLabels);
    const cancelledByDay = countByDay(cancelledRows, dayLabels);
    const noShowByDay = countByDay(noShowRows, dayLabels);
    const dailyTotals = completedByDay.map(
      (completed, idx) => completed + cancelledByDay[idx] + noShowByDay[idx],
    );

    const sum = (rows: number[]) => rows.reduce((acc, n) => acc + n, 0);
    const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);
    const toWeekly = (rows: number[]) => {
      const out: number[] = [];
      for (let i = 0; i < rows.length; i += 7) {
        out.push(sum(rows.slice(i, i + 7)));
      }
      return out;
    };

    const totalCompleted = sum(completedByDay);
    const totalCancelled = sum(cancelledByDay);
    const totalNoShow = sum(noShowByDay);
    const totalOperational = totalCompleted + totalCancelled + totalNoShow;

    const profileIds = topReviewGroups.map((g) => g.physiotherapistId);
    const topOpsProfileIds = topPhysioByCompletedBookings.map(
      (g) => g.physiotherapistId,
    );
    const allProfileIds = Array.from(new Set([...profileIds, ...topOpsProfileIds]));
    const profiles =
      allProfileIds.length > 0
        ? await this.prisma.physiotherapistProfile.findMany({
            where: { id: { in: allProfileIds } },
            select: {
              id: true,
              user: { select: { fullName: true } },
            },
          })
        : [];
    const nameById = new Map(profiles.map((p) => [p.id, p.user.fullName]));

    const visibleAvg = await this.prisma.review.aggregate({
      where: { isHidden: false },
      _avg: { rating: true },
    });

    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      periodStart: since.toISOString(),
      trends: {
        labels: dayLabels,
        newUsers: countByDay(usersInPeriod, dayLabels),
        newBookings: countByDay(bookingsInPeriod, dayLabels),
        newConsultations: countByDay(consultationsInPeriod, dayLabels),
        paidRevenue: sumMoneyByDay(paidRows, dayLabels),
        bookingCompleted: completedByDay,
        bookingCancelled: cancelledByDay,
        bookingNoShowEstimated: noShowByDay,
      },
      operationalKpis: {
        bookingSuccessRate: ratio(totalCompleted, totalOperational),
        cancelRate: ratio(totalCancelled, totalOperational),
        noShowRate: ratio(totalNoShow, totalOperational),
        repeatPatientRate: ratio(
          repeatPatientRaw.filter((row) => row._count._all >= 2).length,
          repeatPatientRaw.length,
        ),
        totals: {
          completed: totalCompleted,
          cancelled: totalCancelled,
          noShowEstimated: totalNoShow,
        },
      },
      operationalWeekly: {
        bucketDays: 7,
        bookingCompleted: toWeekly(completedByDay),
        bookingCancelled: toWeekly(cancelledByDay),
        bookingNoShowEstimated: toWeekly(noShowByDay),
        totalOperational: toWeekly(dailyTotals),
      },
      reviews: {
        averageRating: visibleAvg._avg.rating ?? null,
        ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({
          rating,
          count:
            ratingGroups.find((g) => g.rating === rating)?._count._all ?? 0,
        })),
        bySource: {
          booking: reviewsFromBookingCount,
          consultation: reviewsFromConsultationCount,
        },
      },
      paymentMix: {
        paidBookingCount: paidBookingAgg._count._all,
        paidConsultationCount: paidConsultationAgg._count._all,
        paidBookingRevenue: paidBookingAgg._sum.amount ?? 0,
        paidConsultationRevenue: paidConsultationAgg._sum.amount ?? 0,
      },
      topTherapistsByRating: topReviewGroups.map((row) => ({
        physiotherapistId: row.physiotherapistId,
        fullName: nameById.get(row.physiotherapistId) ?? 'Unknown',
        averageRating: row._avg.rating ?? null,
        reviewCount: row._count._all,
      })),
      topPhysiotherapistsByCompletedBookings: topPhysioByCompletedBookings.map(
        (row) => ({
          physiotherapistId: row.physiotherapistId,
          fullName: nameById.get(row.physiotherapistId) ?? 'Unknown',
          completedBookingCount: row._count._all,
        }),
      ),
      auditLogsInPeriod: auditInPeriod,
    };
  }
}
