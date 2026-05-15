import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  isEmailVerificationRequired,
  resolveFrontendUrl,
} from '../mail/mail.config';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  isRequired(): boolean {
    return isEmailVerificationRequired();
  }

  async sendVerificationEmail(user: {
    id: string;
    email: string;
    fullName: string;
  }): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const verifyUrl = `${resolveFrontendUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
    const subject = 'Verifikasi email — Physio Booking';
    const text = [
      `Halo ${user.fullName},`,
      '',
      'Terima kasih telah mendaftar. Klik tautan berikut untuk memverifikasi email Anda:',
      verifyUrl,
      '',
      'Tautan berlaku 24 jam. Jika Anda tidak mendaftar, abaikan email ini.',
    ].join('\n');

    const html = `
      <p>Halo <strong>${this.escapeHtml(user.fullName)}</strong>,</p>
      <p>Terima kasih telah mendaftar. Klik tombol di bawah untuk memverifikasi email Anda:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Verifikasi email</a></p>
      <p style="font-size:12px;color:#64748b">Atau salin tautan ini: ${verifyUrl}</p>
      <p style="font-size:12px;color:#64748b">Tautan berlaku 24 jam.</p>
    `;

    await this.mailService.sendMail({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  async verifyToken(rawToken: string): Promise<{ email: string }> {
    const token = rawToken?.trim();
    if (!token) {
      throw new BadRequestException('Token verifikasi tidak valid.');
    }

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!record) {
      throw new BadRequestException(
        'Token verifikasi tidak valid atau sudah digunakan.',
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await this.prisma.emailVerificationToken.delete({
        where: { id: record.id },
      });
      throw new BadRequestException(
        'Token verifikasi sudah kedaluwarsa. Minta link baru.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return { email: record.user.email };
  }

  async resendForEmail(email: string): Promise<{ message: string }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerifiedAt: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return {
        message:
          'Jika email terdaftar, kami mengirim link verifikasi. Periksa inbox Anda.',
      };
    }

    if (user.emailVerifiedAt) {
      return { message: 'Email sudah diverifikasi. Anda bisa masuk.' };
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Akun ini masuk lewat Google atau penyedia lain. Gunakan metode masuk tersebut.',
      );
    }

    await this.sendVerificationEmail(user);
    return {
      message:
        'Jika email terdaftar, kami mengirim link verifikasi. Periksa inbox Anda.',
    };
  }

  verifiedAtForNewPasswordUser(): Date | null {
    return this.isRequired() ? null : new Date();
  }

  verifiedAtForOAuthUser(): Date {
    return new Date();
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
