import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
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
      throw new BadRequestException(
        'Public registration cannot create admin account.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
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
