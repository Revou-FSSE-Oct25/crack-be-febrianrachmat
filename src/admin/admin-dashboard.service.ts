import { Injectable } from '@nestjs/common';

import {

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

    ]);



    const paidRows = paidTxInPeriod

      .filter((tx) => tx.paidAt != null)

      .map((tx) => ({

        createdAt: tx.paidAt as Date,

        amount: tx.amount,

      }));



    const profileIds = topReviewGroups.map((g) => g.physiotherapistId);

    const profiles =

      profileIds.length > 0

        ? await this.prisma.physiotherapistProfile.findMany({

            where: { id: { in: profileIds } },

            select: {

              id: true,

              user: { select: { fullName: true } },

            },

          })

        : [];

    const nameById = new Map(

      profiles.map((p) => [p.id, p.user.fullName]),

    );



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

      auditLogsInPeriod: auditInPeriod,

    };

  }

}


