import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  badRequestBusinessError,
  unauthorizedBusinessError,
} from '../common/errors/business-error';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AuthUserResponse = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    accessToken: string;
    user: AuthUserResponse;
  }> {
    if (dto.role === UserRole.ADMIN) {
      throw badRequestBusinessError(
        'REGISTRATION_ROLE_FORBIDDEN',
        'Public registration cannot create admin account.',
        undefined,
        { messageKey: 'auth.REGISTRATION_ROLE_FORBIDDEN' },
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw badRequestBusinessError(
        'EMAIL_ALREADY_REGISTERED',
        'Email is already registered.',
        undefined,
        { messageKey: 'auth.EMAIL_ALREADY_REGISTERED' },
      );
    }

    const passwordHash = await hash(dto.password, 10);

    const createdUser = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        passwordHash,
        phoneNumber: dto.phoneNumber,
        role: dto.role,
        patientProfile:
          dto.role === UserRole.PATIENT ? { create: {} } : undefined,
        physiotherapistProfile:
          dto.role === UserRole.PHYSIOTHERAPIST
            ? {
                create: {
                  consultationFee: 0,
                  visitFee: 0,
                },
              }
            : undefined,
      },
    });

    const accessToken = await this.signToken(
      createdUser.id,
      createdUser.email,
      createdUser.role,
    );

    return {
      accessToken,
      user: this.mapAuthUser(createdUser),
    };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    user: AuthUserResponse;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw unauthorizedBusinessError(
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        undefined,
        { messageKey: 'auth.INVALID_CREDENTIALS' },
      );
    }

    if (!user.passwordHash) {
      throw unauthorizedBusinessError(
        'SOCIAL_LOGIN_ONLY',
        'This account uses social login. Sign in with Google, Apple, GitHub, or Facebook.',
        undefined,
        { messageKey: 'auth.SOCIAL_LOGIN_ONLY' },
      );
    }

    const isPasswordValid = await compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw unauthorizedBusinessError(
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        undefined,
        { messageKey: 'auth.INVALID_CREDENTIALS' },
      );
    }

    if (!user.isActive) {
      throw unauthorizedBusinessError(
        'ACCOUNT_INACTIVE',
        'Your account is inactive.',
        undefined,
        { messageKey: 'auth.ACCOUNT_INACTIVE' },
      );
    }

    const accessToken = await this.signToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: this.mapAuthUser(user),
    };
  }

  private async signToken(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    return this.jwtService.signAsync(payload);
  }

  private mapAuthUser(user: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  }): AuthUserResponse {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
