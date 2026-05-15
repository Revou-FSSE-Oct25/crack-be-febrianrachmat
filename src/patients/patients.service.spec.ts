import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  const prismaMock = {
    patientProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new PatientsService(prismaMock as never);
  const PATIENT_USER = {
    sub: 'patient-user-1',
    email: 'p@mail.com',
    role: UserRole.PATIENT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns patient profile for getMyProfile', async () => {
    const profile = { id: 'patient-1', userId: PATIENT_USER.sub };
    prismaMock.patientProfile.findUnique.mockResolvedValue(profile);

    await expect(service.getMyProfile(PATIENT_USER)).resolves.toEqual(profile);
    expect(prismaMock.patientProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: PATIENT_USER.sub } }),
    );
  });

  it('throws when patient profile missing on getMyProfile', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue(null);
    await expect(service.getMyProfile(PATIENT_USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates patient profile fields', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue({
      id: 'patient-1',
    });
    prismaMock.patientProfile.update.mockResolvedValue({ id: 'patient-1' });

    await service.updateMyProfile(PATIENT_USER, {
      gender: 'M',
      address: 'Jl. Sehat No. 10',
      emergencyContactName: 'Budi',
      emergencyContactPhone: '08123456789',
      dateOfBirth: '1990-05-15',
    });

    expect(prismaMock.patientProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: PATIENT_USER.sub },
        data: expect.objectContaining({
          gender: 'M',
          address: 'Jl. Sehat No. 10',
          dateOfBirth: expect.any(Date),
        }),
      }),
    );
  });

  it('throws when patient profile missing on updateMyProfile', async () => {
    prismaMock.patientProfile.findUnique.mockResolvedValue(null);
    await expect(
      service.updateMyProfile(PATIENT_USER, { gender: 'F' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
