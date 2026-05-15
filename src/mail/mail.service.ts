import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import { isSmtpConfigured } from './mail.config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const secure =
        process.env.SMTP_SECURE === 'true' || String(port) === '465';

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });
    }
    return this.transporter;
  }

  async sendMail(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const from = process.env.MAIL_FROM?.trim();
    if (!from) {
      this.logger.warn(
        `[mail] MAIL_FROM unset — verification email to ${params.to}:\n${params.text}`,
      );
      return;
    }

    if (!isSmtpConfigured()) {
      this.logger.warn(
        `[mail:dev] To: ${params.to}\nSubject: ${params.subject}\n${params.text}`,
      );
      return;
    }

    await this.getTransporter().sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}
