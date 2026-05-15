import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BookingStatus,
  ConsultationStatus,
  TherapistVerificationStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

const userPublicSelect = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(authUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: userPublicSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.mapPublicUser(user);
  }

  private mapPublicUser(user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    avatarUrl: string | null;
    role: UserRole;
    isActive: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const { emailVerifiedAt, ...rest } = user;
    return {
      ...rest,
      emailVerified: Boolean(emailVerifiedAt),
    };
  }

  async updateMyProfile(authUser: AuthUser, dto: UpdateMyProfileDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: authUser.sub },
      data: {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
      },
      select: userPublicSelect,
    });

    return this.mapPublicUser(updatedUser);
  }

  async uploadAvatar(authUser: AuthUser, uploadedPublicPath: string) {
    const updated = await this.prisma.user.update({
      where: { id: authUser.sub },
      data: { avatarUrl: uploadedPublicPath },
      select: userPublicSelect,
    });
    return this.mapPublicUser(updated);
  }

  async streamMyAvatar(authUser: AuthUser, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.streamAvatarFromUrl(user.avatarUrl, res);
  }

  private streamAvatarFromUrl(avatarUrl: string | null | undefined, res: Response) {
    const url = avatarUrl?.trim();
    if (!url) {
      throw new NotFoundException('No profile photo uploaded.');
    }

    if (url.startsWith('https://') || url.startsWith('http://')) {
      res.redirect(url);
      return;
    }

    if (!url.startsWith('/uploads/avatars/')) {
      throw new BadRequestException('Invalid avatar storage path.');
    }

    const filename = url.replace('/uploads/avatars/', '');
    if (!filename || filename.includes('..')) {
      throw new BadRequestException('Invalid avatar path.');
    }

    const filePath = join(process.cwd(), 'uploads', 'avatars', filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Avatar file not found on server.');
    }

    res.sendFile(filePath);
  }

  async getMyActivitySummary(authUser: AuthUser) {
    if (authUser.role === UserRole.ADMIN) {
      const [pendingVerifications, pendingTransactions, openConsultations] =
        await Promise.all([
          this.prisma.physiotherapistProfile.count({
            where: { verificationStatus: TherapistVerificationStatus.PENDING },
          }),
          this.prisma.transaction.count({
            where: { status: TransactionStatus.PENDING },
          }),
          this.prisma.consultation.count({
            where: {
              status: {
                in: [
                  ConsultationStatus.REQUESTED,
                  ConsultationStatus.ACCEPTED,
                  ConsultationStatus.IN_PROGRESS,
                ],
              },
            },
          }),
        ]);

      return {
        role: UserRole.ADMIN,
        pendingVerifications,
        transactionsPending: pendingTransactions,
        consultationsActive: openConsultations,
      };
    }

    if (authUser.role === UserRole.PATIENT) {
      const patient = await this.prisma.patientProfile.findUnique({
        where: { userId: authUser.sub },
      });
      if (!patient) {
        throw new NotFoundException('Patient profile not found.');
      }
      return this.buildPatientActivitySummary(patient.id);
    }

    const therapist = await this.prisma.physiotherapistProfile.findUnique({
      where: { userId: authUser.sub },
    });
    if (!therapist) {
      throw new NotFoundException('Physiotherapist profile not found.');
    }
    return this.buildTherapistActivitySummary(therapist.id);
  }

  private async buildPatientActivitySummary(patientId: string) {
    const activeConsultationStatuses: ConsultationStatus[] = [
      ConsultationStatus.REQUESTED,
      ConsultationStatus.ACCEPTED,
      ConsultationStatus.IN_PROGRESS,
    ];
    const pendingBookingStatuses: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    const [
      bookingsTotal,
      bookingsPending,
      bookingsCompleted,
      consultationsTotal,
      consultationsActive,
      consultationsCompleted,
      transactionsPending,
      reviews,
      lastBooking,
      lastConsultation,
    ] = await Promise.all([
      this.prisma.booking.count({ where: { patientId } }),
      this.prisma.booking.count({
        where: { patientId, status: { in: pendingBookingStatuses } },
      }),
      this.prisma.booking.count({
        where: { patientId, status: BookingStatus.COMPLETED },
      }),
      this.prisma.consultation.count({ where: { patientId } }),
      this.prisma.consultation.count({
        where: { patientId, status: { in: activeConsultationStatuses } },
      }),
      this.prisma.consultation.count({
        where: { patientId, status: ConsultationStatus.COMPLETED },
      }),
      this.prisma.transaction.count({
        where: { patientId, status: TransactionStatus.PENDING },
      }),
      this.prisma.review.count({ where: { patientId } }),
      this.prisma.booking.findFirst({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.consultation.findFirst({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      role: UserRole.PATIENT,
      bookings: {
        total: bookingsTotal,
        pending: bookingsPending,
        completed: bookingsCompleted,
      },
      consultations: {
        total: consultationsTotal,
        active: consultationsActive,
        completed: consultationsCompleted,
      },
      transactionsPending,
      reviews,
      lastActivityAt: this.latestIso(
        lastBooking?.createdAt,
        lastConsultation?.createdAt,
      ),
    };
  }

  private async buildTherapistActivitySummary(physiotherapistId: string) {
    const activeConsultationStatuses: ConsultationStatus[] = [
      ConsultationStatus.REQUESTED,
      ConsultationStatus.ACCEPTED,
      ConsultationStatus.IN_PROGRESS,
    ];
    const pendingBookingStatuses: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    const [
      bookingsTotal,
      bookingsPending,
      bookingsCompleted,
      consultationsTotal,
      consultationsActive,
      consultationsCompleted,
      reviews,
      lastBooking,
      lastConsultation,
    ] = await Promise.all([
      this.prisma.booking.count({ where: { physiotherapistId } }),
      this.prisma.booking.count({
        where: {
          physiotherapistId,
          status: { in: pendingBookingStatuses },
        },
      }),
      this.prisma.booking.count({
        where: {
          physiotherapistId,
          status: BookingStatus.COMPLETED,
        },
      }),
      this.prisma.consultation.count({ where: { physiotherapistId } }),
      this.prisma.consultation.count({
        where: {
          physiotherapistId,
          status: { in: activeConsultationStatuses },
        },
      }),
      this.prisma.consultation.count({
        where: {
          physiotherapistId,
          status: ConsultationStatus.COMPLETED,
        },
      }),
      this.prisma.review.count({ where: { physiotherapistId } }),
      this.prisma.booking.findFirst({
        where: { physiotherapistId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.consultation.findFirst({
        where: { physiotherapistId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      role: UserRole.PHYSIOTHERAPIST,
      bookings: {
        total: bookingsTotal,
        pending: bookingsPending,
        completed: bookingsCompleted,
      },
      consultations: {
        total: consultationsTotal,
        active: consultationsActive,
        completed: consultationsCompleted,
      },
      reviews,
      lastActivityAt: this.latestIso(
        lastBooking?.createdAt,
        lastConsultation?.createdAt,
      ),
    };
  }

  private latestIso(
    a?: Date | null,
    b?: Date | null,
  ): string | null {
    const dates = [a, b].filter((d): d is Date => d instanceof Date);
    if (dates.length === 0) return null;
    const max = dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
    return max.toISOString();
  }

  async deactivateAccount(authUser: AuthUser, dto: DeactivateAccountDto) {
    if (authUser.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Admin accounts cannot be self-deactivated.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { id: true, passwordHash: true, role: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.isActive) {
      throw new BadRequestException('Account is already inactive.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Akun masuk lewat Google/Apple/GitHub/Facebook. Nonaktifkan lewat penyedia masuk atau hubungi dukungan.',
      );
    }

    const isValid = await compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    return {
      message:
        'Akun Anda telah dinonaktifkan. Hubungi admin jika ingin mengaktifkan kembali.',
    };
  }

  async changePassword(authUser: AuthUser, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Akun masuk lewat Google/Apple/GitHub/Facebook. Atur kata sandi belum tersedia untuk akun ini.',
      );
    }

    const isCurrentPasswordValid = await compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const newPasswordHash = await hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully.' };
  }
}
