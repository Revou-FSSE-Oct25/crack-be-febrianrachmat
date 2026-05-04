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
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { BrowsePhysiotherapistsQueryDto } from './dto/browse-physiotherapists-query.dto';
import { UpdatePhysiotherapistProfileDto } from './dto/update-physiotherapist-profile.dto';
import { VerifyPhysiotherapistDto } from './dto/verify-physiotherapist.dto';

@Injectable()
export class PhysiotherapistsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async browseApproved(query: BrowsePhysiotherapistsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.PhysiotherapistProfileWhereInput = {
      verificationStatus: TherapistVerificationStatus.APPROVED,
      categoryId: query.categoryId,
      OR: query.search
        ? [
            { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
            { bio: { contains: query.search, mode: 'insensitive' } },
            { education: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.physiotherapistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phoneNumber: true },
          },
          category: true,
        },
      }),
      this.prisma.physiotherapistProfile.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
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

    return this.prisma.physiotherapistProfile.update({
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
  }
}
