import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TherapistVerificationStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import {
  attachReviewStats,
  isRatingSort,
  resolveBrowseOrderBy,
  sortProfileIdsByRating,
} from './browse.helpers';
import { BrowsePhysiotherapistsQueryDto } from './dto/browse-physiotherapists-query.dto';
import { UpdatePhysiotherapistProfileDto } from './dto/update-physiotherapist-profile.dto';
import { VerifyPhysiotherapistDto } from './dto/verify-physiotherapist.dto';

const browseProfileInclude = {
  user: {
    select: { id: true, fullName: true, email: true, phoneNumber: true },
  },
  category: true,
  reviews: {
    where: { isHidden: false },
    select: { rating: true },
  },
} satisfies Prisma.PhysiotherapistProfileInclude;

/** Presence window after each heartbeat (therapist dashboard tab open). */
const ONLINE_HEARTBEAT_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PhysiotherapistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Bump `onlineUntil` so this therapist appears in GET /physiotherapists
   * when `onlineNow=true`. Call every ~60s from the therapist SPA while
   * they are actively using the app.
   */
  async touchMyOnlinePresence(authUser: AuthUser) {
    const profile = await this.prisma.physiotherapistProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!profile) {
      throw new NotFoundException('Physiotherapist profile not found.');
    }
    const until = new Date(Date.now() + ONLINE_HEARTBEAT_TTL_MS);
    return this.prisma.physiotherapistProfile.update({
      where: { id: profile.id },
      data: { onlineUntil: until },
      select: {
        id: true,
        onlineUntil: true,
      },
    });
  }

  async getMyProfile(authUser: AuthUser) {
    const profile = await this.prisma.physiotherapistProfile.findUnique({
      where: { userId: authUser.sub },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
        },
        category: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Physiotherapist profile not found.');
    }

    return profile;
  }

  async updateMyProfile(
    authUser: AuthUser,
    dto: UpdatePhysiotherapistProfileDto,
  ) {
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Category does not exist.');
      }
    }

    const data: Prisma.PhysiotherapistProfileUpdateInput = {
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      bio: dto.bio,
      education: dto.education,
      experienceYears: dto.experienceYears,
      certificationUrl: dto.certificationUrl,
      licenseNumber: dto.licenseNumber,
      consultationFee:
        dto.consultationFee !== undefined
          ? new Prisma.Decimal(dto.consultationFee)
          : undefined,
      visitFee:
        dto.visitFee !== undefined
          ? new Prisma.Decimal(dto.visitFee)
          : undefined,
      clinicAddress: dto.clinicAddress,
      // Any profile change sends status back to pending for admin review.
      verificationStatus: TherapistVerificationStatus.PENDING,
      rejectionReason: null,
      verifiedAt: null,
    };

    const updated = await this.prisma.physiotherapistProfile.update({
      where: { userId: authUser.sub },
      data,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
        },
        category: true,
      },
    });

    return updated;
  }

  async getApprovedById(profileId: string) {
    const profile = await this.prisma.physiotherapistProfile.findFirst({
      where: {
        id: profileId,
        verificationStatus: TherapistVerificationStatus.APPROVED,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
        },
        category: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Physiotherapist not found or not approved yet.',
      );
    }

    return profile;
  }

  async browseApproved(query: BrowsePhysiotherapistsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildBrowseWhere(query);

    if (where === null) {
      return {
        page,
        limit,
        total: 0,
        totalPages: 0,
        items: [],
      };
    }

    if (isRatingSort(query.sort)) {
      return this.browseApprovedByRating(query, where, page, limit, skip);
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.physiotherapistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: resolveBrowseOrderBy(query.sort),
        include: browseProfileInclude,
      }),
      this.prisma.physiotherapistProfile.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: rows.map((row) => attachReviewStats(row)),
    };
  }

  private async buildBrowseWhere(
    query: BrowsePhysiotherapistsQueryDto,
  ): Promise<Prisma.PhysiotherapistProfileWhereInput | null> {
    const now = new Date();
    const where: Prisma.PhysiotherapistProfileWhereInput = {
      verificationStatus: TherapistVerificationStatus.APPROVED,
      categoryId: query.categoryId,
      ...(query.onlineNow === true
        ? { onlineUntil: { gt: now } }
        : {}),
      OR: query.search
        ? [
            {
              user: {
                fullName: { contains: query.search, mode: 'insensitive' },
              },
            },
            { bio: { contains: query.search, mode: 'insensitive' } },
            { education: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    if (query.minRating != null) {
      const qualified = await this.prisma.review.groupBy({
        by: ['physiotherapistId'],
        where: { isHidden: false },
        _avg: { rating: true },
        having: {
          rating: { _avg: { gte: query.minRating } },
        },
      });
      const ids = qualified.map((row) => row.physiotherapistId);
      if (ids.length === 0) {
        return null;
      }
      where.id = { in: ids };
    }

    return where;
  }

  private async browseApprovedByRating(
    query: BrowsePhysiotherapistsQueryDto,
    where: Prisma.PhysiotherapistProfileWhereInput,
    page: number,
    limit: number,
    skip: number,
  ) {
    const matching = await this.prisma.physiotherapistProfile.findMany({
      where,
      select: { id: true },
    });
    const total = matching.length;
    if (total === 0) {
      return { page, limit, total: 0, totalPages: 0, items: [] };
    }

    const profileIds = matching.map((row) => row.id);
    const aggregates = await this.prisma.review.groupBy({
      by: ['physiotherapistId'],
      where: {
        physiotherapistId: { in: profileIds },
        isHidden: false,
      },
      _avg: { rating: true },
    });

    const sortedIds = sortProfileIdsByRating(
      profileIds,
      aggregates,
      query.sort as 'rating_desc' | 'rating_asc',
    );
    const pageIds = sortedIds.slice(skip, skip + limit);

    const rows = await this.prisma.physiotherapistProfile.findMany({
      where: { id: { in: pageIds } },
      include: browseProfileInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: ordered.map((row) => attachReviewStats(row)),
    };
  }

  async listPendingForAdmin() {
    return this.prisma.physiotherapistProfile.findMany({
      where: { verificationStatus: TherapistVerificationStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
        },
        category: true,
      },
    });
  }

  async verifyByAdmin(profileId: string, dto: VerifyPhysiotherapistDto) {
    if (
      dto.status === TherapistVerificationStatus.REJECTED &&
      !dto.rejectionReason
    ) {
      throw new BadRequestException(
        'rejectionReason is required when status is REJECTED.',
      );
    }

    if (
      dto.status === TherapistVerificationStatus.PENDING
    ) {
      throw new BadRequestException('Admin verification must be APPROVED or REJECTED.');
    }

    const existing = await this.prisma.physiotherapistProfile.findUnique({
      where: { id: profileId },
    });

    if (!existing) {
      throw new NotFoundException('Physiotherapist profile not found.');
    }

    const updated = await this.prisma.physiotherapistProfile.update({
      where: { id: profileId },
      data: {
        verificationStatus: dto.status,
        rejectionReason:
          dto.status === TherapistVerificationStatus.REJECTED
            ? dto.rejectionReason ?? null
            : null,
        verifiedAt:
          dto.status === TherapistVerificationStatus.APPROVED
            ? new Date()
            : null,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phoneNumber: true, role: true },
        },
        category: true,
      },
    });

    await this.safeNotify(
      updated.user.id,
      'Verification Status Updated',
      dto.status === TherapistVerificationStatus.APPROVED
        ? 'Your physiotherapist profile has been approved by admin.'
        : `Your profile was rejected. Reason: ${dto.rejectionReason ?? 'N/A'}`,
    );

    return updated;
  }

  private async safeNotify(
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createSystemNotification(userId, title, body);
    } catch {
      // Notification failures should not block verification flow.
    }
  }
}
