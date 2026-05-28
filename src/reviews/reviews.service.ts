import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  BookingStatus,
  ConsultationStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  mapReviewResponse,
  REVIEW_MUTATION_WINDOW_HOURS,
} from './review.helpers';
import { badRequestBusinessError } from '../common/errors/business-error';

type ReviewTarget =
  | { kind: 'booking'; bookingId: string; physiotherapistId: string }
  | {
      kind: 'consultation';
      consultationId: string;
      physiotherapistId: string;
    };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async createReview(authUser: AuthUser, dto: CreateReviewDto) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patient) throw new BadRequestException('Patient profile not found.');

    const target = await this.resolveReviewTarget(patient.id, dto);

    const existing =
      target.kind === 'booking'
        ? await this.prisma.review.findUnique({
            where: {
              bookingId_patientId: {
                bookingId: target.bookingId,
                patientId: patient.id,
              },
            },
          })
        : await this.prisma.review.findUnique({
            where: {
              consultationId_patientId: {
                consultationId: target.consultationId,
                patientId: patient.id,
              },
            },
          });

    if (existing) {
      throw badRequestBusinessError(
        'REVIEW_DUPLICATE',
        target.kind === 'booking'
          ? 'Review already exists for this booking.'
          : 'Review already exists for this consultation.',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId: target.kind === 'booking' ? target.bookingId : null,
        consultationId:
          target.kind === 'consultation' ? target.consultationId : null,
        patientId: patient.id,
        physiotherapistId: target.physiotherapistId,
        rating: dto.rating,
        comment: this.normalizeReviewComment(dto.comment),
      },
    });

    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: target.physiotherapistId },
      select: { userId: true },
    });
    if (therapist) {
      const sessionLabel =
        target.kind === 'booking' ? 'booking visit' : 'online consultation';
      await this.safeNotify(
        therapist.userId,
        'New Review Received',
        `You received a new ${sessionLabel} review with rating ${dto.rating}/5.`,
      );
    }

    return mapReviewResponse(review);
  }

  async updateMyReview(
    authUser: AuthUser,
    reviewId: string,
    dto: UpdateReviewDto,
  ) {
    if (dto.rating === undefined && dto.comment === undefined) {
      throw new BadRequestException(
        'At least one of rating or comment must be provided.',
      );
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found.');

    if (authUser.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patient can update own review.');
    }

    const patient = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patient || review.patientId !== patient.id) {
      throw new NotFoundException('Review not found.');
    }
    this.assertReviewMutable(review.createdAt, review.isHidden);

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: dto.rating,
        comment: this.normalizeReviewComment(dto.comment),
      },
    });

    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: review.physiotherapistId },
      select: { userId: true },
    });
    if (therapist) {
      await this.safeNotify(
        therapist.userId,
        'Review Updated',
        `A patient updated their review (now ${updated.rating}/5).`,
      );
    }

    return mapReviewResponse(updated);
  }

  async listPublicReviewsByPhysiotherapist(
    physiotherapistId: string,
    query: ListReviewsQueryDto,
  ) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;
    const orderBy = this.resolveReviewOrderBy(query.sort);

    const rows = await this.prisma.review.findMany({
      where: {
        physiotherapistId,
        isHidden: false,
        ...this.buildReviewFilter(query),
      },
      orderBy,
      skip,
      take,
      include: {
        patient: { include: { user: { select: { fullName: true } } } },
      },
    });

    return rows.map((row) => {
      const { patient, ...rest } = row;
      return {
        ...mapReviewResponse(rest),
        patientName: patient.user.fullName,
      };
    });
  }

  async listMyReviews(authUser: AuthUser, query: ListReviewsQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;
    const orderBy = this.resolveReviewOrderBy(query.sort);
    const filter = this.buildReviewFilter(query);

    if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient) throw new BadRequestException('Patient profile not found.');
      const rows = await this.prisma.review.findMany({
        where: { patientId: patient.id, ...filter },
        orderBy,
        skip,
        take,
      });
      return rows.map(mapReviewResponse);
    }

    if (authUser.role === UserRole.PHYSIOTHERAPIST) {
      const therapist = await this.prisma.physiotherapistProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!therapist) {
        throw new BadRequestException('Physiotherapist profile not found.');
      }
      const rows = await this.prisma.review.findMany({
        where: { physiotherapistId: therapist.id, ...filter },
        orderBy,
        skip,
        take,
      });
      return rows.map(mapReviewResponse);
    }

    const rows = await this.prisma.review.findMany({
      where: filter,
      orderBy,
      skip,
      take,
    });
    return rows.map(mapReviewResponse);
  }

  async moderateReview(
    authUser: AuthUser,
    reviewId: string,
    dto: ModerateReviewDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found.');

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        isHidden: dto.isHidden,
        moderationNote: dto.moderationNote ?? null,
      },
    });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: review.patientId },
      select: { userId: true },
    });
    if (patient) {
      await this.safeNotify(
        patient.userId,
        'Review Moderation Update',
        dto.isHidden
          ? 'Your review was hidden by admin moderation.'
          : 'Your review is visible again after moderation.',
      );
    }

    await this.auditService.record({
      action: AuditAction.REVIEW_MODERATE,
      entityType: AuditEntityType.REVIEW,
      entityId: reviewId,
      actor: authUser,
      metadata: {
        isHidden: dto.isHidden,
        moderationNote: dto.moderationNote ?? null,
        physiotherapistId: review.physiotherapistId,
        patientId: review.patientId,
      },
    });

    return mapReviewResponse(updated);
  }

  async deleteMyReview(authUser: AuthUser, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found.');

    if (authUser.role !== UserRole.PATIENT) {
      throw new ForbiddenException('Only patient can delete own review.');
    }
    const patient = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!patient || review.patientId !== patient.id) {
      throw new NotFoundException('Review not found.');
    }
    this.assertReviewMutable(review.createdAt, review.isHidden);

    await this.prisma.review.delete({ where: { id: reviewId } });
    return { message: 'Review deleted successfully.' };
  }

  private async resolveReviewTarget(
    patientId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewTarget> {
    const hasBooking = dto.bookingId != null && dto.bookingId !== '';
    const hasConsultation =
      dto.consultationId != null && dto.consultationId !== '';

    if (hasBooking === hasConsultation) {
      throw new BadRequestException(
        'Provide exactly one of bookingId or consultationId.',
      );
    }

    if (hasBooking) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking || booking.patientId !== patientId) {
        throw new BadRequestException('Booking not found for current patient.');
      }
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException(
          'Review can only be created for completed booking.',
        );
      }
      return {
        kind: 'booking',
        bookingId: booking.id,
        physiotherapistId: booking.physiotherapistId,
      };
    }

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: dto.consultationId },
    });
    if (!consultation || consultation.patientId !== patientId) {
      throw new BadRequestException(
        'Consultation not found for current patient.',
      );
    }
    if (consultation.status !== ConsultationStatus.COMPLETED) {
      throw new BadRequestException(
        'Review can only be created for completed consultation.',
      );
    }

    return {
      kind: 'consultation',
      consultationId: consultation.id,
      physiotherapistId: consultation.physiotherapistId,
    };
  }

  private async safeNotify(
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createSystemNotification(userId, title, body);
    } catch {
      // Notification failures should not break review operations.
    }
  }

  private normalizeReviewComment(comment?: string): string | null | undefined {
    if (comment === undefined) {
      return undefined;
    }
    const normalized = comment.trim();
    return normalized === '' ? null : normalized;
  }

  private assertReviewMutable(createdAt: Date, isHidden: boolean): void {
    if (isHidden) {
      throw badRequestBusinessError(
        'REVIEW_LOCKED',
        'Review is currently moderated and cannot be edited or deleted.',
      );
    }
    const editableUntil = new Date(
      createdAt.getTime() + REVIEW_MUTATION_WINDOW_HOURS * 60 * 60 * 1000,
    );
    if (Date.now() > editableUntil.getTime()) {
      throw badRequestBusinessError(
        'REVIEW_LOCKED',
        `Review can only be edited or deleted within ${REVIEW_MUTATION_WINDOW_HOURS} hours after submission.`,
      );
    }
  }

  private resolveReviewOrderBy(
    sort?: ListReviewsQueryDto['sort'],
  ):
    | Prisma.ReviewOrderByWithRelationInput
    | Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
      case 'createdAt_asc':
        return { createdAt: 'asc' };
      case 'rating_desc':
        return [{ rating: 'desc' }, { createdAt: 'desc' }];
      case 'rating_asc':
        return [{ rating: 'asc' }, { createdAt: 'desc' }];
      case 'createdAt_desc':
      default:
        return { createdAt: 'desc' };
    }
  }

  private buildReviewFilter(
    query: ListReviewsQueryDto,
  ): Prisma.ReviewWhereInput {
    return {
      ...(query.sourceType === 'BOOKING' && {
        consultationId: null,
        bookingId: { not: null },
      }),
      ...(query.sourceType === 'CONSULTATION' && {
        consultationId: { not: null },
      }),
      ...(query.minRating != null && {
        rating: { gte: query.minRating },
      }),
    };
  }
}

