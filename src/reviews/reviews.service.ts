import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReview(authUser: AuthUser, dto: CreateReviewDto) {
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
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Review can only be created for completed booking.');
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        bookingId_patientId: {
          bookingId: booking.id,
          patientId: patient.id,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Review already exists for this booking.');
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        patientId: patient.id,
        physiotherapistId: booking.physiotherapistId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: booking.physiotherapistId },
      select: { userId: true },
    });
    if (therapist) {
      await this.safeNotify(
        therapist.userId,
        'New Review Received',
        `You received a new review with rating ${dto.rating}/5.`,
      );
    }

    return review;
  }

  async listPublicReviewsByPhysiotherapist(
    physiotherapistId: string,
    query: PaginationQueryDto,
  ) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    return this.prisma.review.findMany({
      where: { physiotherapistId, isHidden: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        patient: { include: { user: { select: { fullName: true } } } },
      },
    });
  }

  async listMyReviews(authUser: AuthUser, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient) throw new BadRequestException('Patient profile not found.');
      return this.prisma.review.findMany({
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
      if (!therapist) throw new BadRequestException('Physiotherapist profile not found.');
      return this.prisma.review.findMany({
        where: { physiotherapistId: therapist.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    }

    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async moderateReview(reviewId: string, dto: ModerateReviewDto) {
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

    return updated;
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
      throw new ForbiddenException('You can only delete your own review.');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    return { message: 'Review deleted successfully.' };
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
}
