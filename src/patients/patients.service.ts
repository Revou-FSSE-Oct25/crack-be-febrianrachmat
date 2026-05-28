import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { notFoundBusinessError } from '../common/errors/business-error';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

const patientProfileInclude = {
  user: {
    select: { id: true, fullName: true, email: true, phoneNumber: true },
  },
} satisfies Prisma.PatientProfileInclude;

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(authUser: AuthUser) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
      include: patientProfileInclude,
    });

    if (!profile) {
      throw notFoundBusinessError(
        'PATIENT_PROFILE_NOT_FOUND',
        'Patient profile not found.',
      );
    }

    return profile;
  }

  async updateMyProfile(authUser: AuthUser, dto: UpdatePatientProfileDto) {
    const existing = await this.prisma.patientProfile.findUnique({
      where: { userId: authUser.sub },
    });

    if (!existing) {
      throw notFoundBusinessError(
        'PATIENT_PROFILE_NOT_FOUND',
        'Patient profile not found.',
      );
    }

    const data: Prisma.PatientProfileUpdateInput = {
      dateOfBirth:
        dto.dateOfBirth !== undefined
          ? new Date(dto.dateOfBirth)
          : undefined,
      gender: dto.gender,
      address: dto.address,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
    };

    return this.prisma.patientProfile.update({
      where: { userId: authUser.sub },
      data,
      include: patientProfileInclude,
    });
  }
}
