import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../../common/security/jwt-config';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          const q = req?.query?.access_token;
          if (typeof q === 'string' && q.length > 0) {
            return q;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Akun tidak ditemukan atau tidak aktif. Silakan masuk kembali.',
      );
    }

    if (user.role !== payload.role || user.email !== payload.email) {
      throw new UnauthorizedException(
        'Sesi kedaluwarsa karena perubahan akun. Silakan masuk kembali.',
      );
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
