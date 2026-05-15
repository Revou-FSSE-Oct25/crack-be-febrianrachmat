import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isEmailMockEnabled } from './email-mock.config';

@Injectable()
export class EmailMockService {
  private readonly logger = new Logger(EmailMockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendNotificationEmail(params: {
    userId: string;
    title: string;
    body: string;
    notificationId?: string;
  }): Promise<void> {
    if (!isEmailMockEnabled()) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      return;
    }

    const lines = [
      '[email:mock] Simulated notification email (not sent via SMTP)',
      `to: ${user.fullName} <${user.email}>`,
      `subject: ${params.title}`,
      `notificationId: ${params.notificationId ?? 'n/a'}`,
      '---',
      params.body,
    ];

    this.logger.log(lines.join('\n'));
  }
}
