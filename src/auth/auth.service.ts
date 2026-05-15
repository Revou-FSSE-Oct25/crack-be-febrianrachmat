import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationService } from './email-verification.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AuthUserResponse = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
};

export type RegisterResult =
  | {
      requiresEmailVerification: true;
      email: string;
      message: string;
    }
  | {
      requiresEmailVerification: false;
      accessToken: string;
      user: AuthUserResponse;
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Public registration cannot create admin account.',
      );
    }

    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    const passwordHash = await hash(dto.password, 10);
    const emailVerifiedAt =
      this.emailVerification.verifiedAtForNewPasswordUser();

    const createdUser = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email,
        passwordHash,
        phoneNumber: dto.phoneNumber,
        role: dto.role,
        emailVerifiedAt,
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

    if (this.emailVerification.isRequired() && !emailVerifiedAt) {
      await this.emailVerification.sendVerificationEmail(createdUser);
      return {
        requiresEmailVerification: true,
        email: createdUser.email,
        message:
          'Kami mengirim link verifikasi ke email Anda. Buka email tersebut, lalu masuk setelah verifikasi.',
      };
    }

    const accessToken = await this.signToken(
      createdUser.id,
      createdUser.email,
      createdUser.role,
    );

    return {
      requiresEmailVerification: false,
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
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses social login. Sign in with Google, Apple, GitHub, or Facebook.',
      );
    }

    const isPasswordValid = await compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive.');
    }

    if (
      this.emailVerification.isRequired() &&
      !user.emailVerifiedAt
    ) {
      throw new ForbiddenException(
        'Email belum diverifikasi. Periksa inbox atau kirim ulang link verifikasi.',
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
    emailVerifiedAt?: Date | null;
  }): AuthUserResponse {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
