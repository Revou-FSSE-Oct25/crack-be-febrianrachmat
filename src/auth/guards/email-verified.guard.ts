import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_UNVERIFIED_EMAIL_KEY } from '../decorators/allow-unverified-email.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isEmailVerificationRequired } from '../../mail/mail.config';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isEmailVerificationRequired()) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_EMAIL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowUnverified) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const userId = req.user?.sub;
    if (!userId) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, passwordHash: true },
    });

    if (!user) {
      return true;
    }

    if (user.emailVerifiedAt || !user.passwordHash) {
      return true;
    }

    throw new ForbiddenException(
      'Email belum diverifikasi. Periksa inbox atau kirim ulang link verifikasi.',
    );
  }
}
