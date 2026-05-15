import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthProvider, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { listEnabledOAuthProviders } from './oauth-config';
import { OAuthStateService } from './oauth-state.service';
import {
  OAuthAuthUser,
  OAuthProviderId,
  OAuthStatePayload,
  NormalizedOAuthProfile,
} from './oauth.types';

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly oauthStateService: OAuthStateService,
  ) {}

  getEnabledProviders(): OAuthProviderId[] {
    return listEnabledOAuthProviders();
  }

  async signInFromOAuthProfile(
    provider: OAuthProvider,
    profile: NormalizedOAuthProfile,
    stateRaw: string | undefined,
  ): Promise<OAuthAuthUser> {
    const state = this.oauthStateService.decode(stateRaw);
    const user = await this.resolveUser(provider, profile, state);
    return this.mapAuthUser(user);
  }

  async issueAccessToken(user: OAuthAuthUser): Promise<string> {
    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }

  buildFrontendCallbackUrl(params: {
    accessToken?: string;
    error?: string;
    next?: string;
  }): string {
    const frontend = process.env.FRONTEND_URL?.trim();
    if (!frontend) {
      throw new BadRequestException(
        'FRONTEND_URL is not configured for OAuth redirects.',
      );
    }

    const url = new URL('/auth/callback', frontend.replace(/\/$/, ''));
    if (params.accessToken) {
      url.searchParams.set('accessToken', params.accessToken);
    }
    if (params.error) {
      url.searchParams.set('error', params.error);
    }
    if (params.next) {
      url.searchParams.set('next', params.next);
    }
    return url.toString();
  }

  private async resolveUser(
    provider: OAuthProvider,
    profile: NormalizedOAuthProfile,
    state: OAuthStatePayload,
  ) {
    if (!profile.providerAccountId) {
      throw new UnauthorizedException('OAuth provider did not return a user id.');
    }

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (linked) {
      return linked.user;
    }

    const email = profile.email?.toLowerCase();
    if (email) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        await this.prisma.$transaction([
          this.prisma.oAuthAccount.create({
            data: {
              userId: existingByEmail.id,
              provider,
              providerAccountId: profile.providerAccountId,
            },
          }),
          ...(existingByEmail.emailVerifiedAt
            ? []
            : [
                this.prisma.user.update({
                  where: { id: existingByEmail.id },
                  data: { emailVerifiedAt: new Date() },
                }),
              ]),
        ]);
        return existingByEmail.emailVerifiedAt
          ? existingByEmail
          : {
              ...existingByEmail,
              emailVerifiedAt: new Date(),
            };
      }
    } else if (!email) {
      throw new UnauthorizedException(
        'Email not provided by the provider. Allow email access and try again.',
      );
    }

    const role = this.resolveSignupRole(state.role);
    if (role === UserRole.ADMIN) {
      throw new BadRequestException('OAuth cannot create admin accounts.');
    }

    return this.prisma.user.create({
      data: {
        fullName: profile.fullName,
        email: email!,
        emailVerifiedAt: new Date(),
        role,
        patientProfile:
          role === UserRole.PATIENT ? { create: {} } : undefined,
        physiotherapistProfile:
          role === UserRole.PHYSIOTHERAPIST
            ? {
                create: {
                  consultationFee: 0,
                  visitFee: 0,
                },
              }
            : undefined,
        oauthAccounts: {
          create: {
            provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      },
    });
  }

  private resolveSignupRole(role: UserRole | undefined): UserRole {
    if (role === UserRole.PATIENT || role === UserRole.PHYSIOTHERAPIST) {
      return role;
    }
    return UserRole.PATIENT;
  }

  private mapAuthUser(user: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  }): OAuthAuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
