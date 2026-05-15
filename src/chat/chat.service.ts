import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsultationStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Phase 1 pay-first rule of thumb:
 *   - Anyone authorised on the consultation may READ the conversation history,
 *     so refunded sessions still keep an audit trail visible.
 *   - Only IN_PROGRESS consultations accept NEW messages or new conversations
 *     (admin is exempt to allow moderation).
 */
const SENDABLE_CONSULTATION_STATUSES: ConsultationStatus[] = [
  ConsultationStatus.IN_PROGRESS,
];

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetConversation(
    authUser: AuthUser,
    dto: CreateOrGetConversationDto,
  ) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: dto.consultationId },
      include: {
        patient: { include: { user: true } },
        physiotherapist: { include: { user: true } },
        conversation: true,
      },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found.');
    }

    this.assertCanAccessConsultation(authUser, consultation);

    // Opening (or re-opening) a chat is only meaningful once the patient has
    // paid and the session is IN_PROGRESS. Admin can always open for moderation.
    if (
      authUser.role !== UserRole.ADMIN &&
      !SENDABLE_CONSULTATION_STATUSES.includes(consultation.status)
    ) {
      throw new BadRequestException(
        `Chat is locked. Consultation must be IN_PROGRESS (current: ${consultation.status}).`,
      );
    }

    if (consultation.conversation) {
      return this.prisma.conversation.findUnique({
        where: { id: consultation.conversation.id },
        include: {
          participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
          messages: {
            include: { sender: { select: { id: true, fullName: true, email: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    const include = {
      participants: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      messages: {
        include: {
          sender: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };

    try {
      return await this.prisma.conversation.create({
        data: {
          consultationId: consultation.id,
          participants: {
            create: [
              { userId: consultation.patient.userId },
              { userId: consultation.physiotherapist.userId },
            ],
          },
        },
        include,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.conversation.findUnique({
          where: { consultationId: consultation.id },
          include,
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async listMyConversations(authUser: AuthUser, query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    if (authUser.role === UserRole.ADMIN) {
      return this.prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          consultation: true,
          participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      });
    }

    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: authUser.sub },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        consultation: true,
        participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
      },
    });
  }

  async listMessages(
    authUser: AuthUser,
    conversationId: string,
    query: PaginationQueryDto,
  ) {
    await this.assertCanAccessConversation(authUser, conversationId);

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
      include: {
        sender: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
  }

  async sendMessage(
    authUser: AuthUser,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.assertCanAccessConversation(
      authUser,
      conversationId,
    );

    // Chat is locked unless the underlying consultation has been paid and is
    // IN_PROGRESS. Admin bypasses this for moderation messages.
    if (authUser.role !== UserRole.ADMIN) {
      if (!conversation.consultationId) {
        throw new BadRequestException(
          'Conversation is not linked to a paid consultation.',
        );
      }
      const consultation = await this.prisma.consultation.findUnique({
        where: { id: conversation.consultationId },
        select: { status: true },
      });
      if (
        !consultation ||
        !SENDABLE_CONSULTATION_STATUSES.includes(consultation.status)
      ) {
        throw new BadRequestException(
          `Chat is locked. Consultation must be IN_PROGRESS (current: ${
            consultation?.status ?? 'UNKNOWN'
          }).`,
        );
      }
    }

    // Ensure sender is listed as participant (especially useful for admin moderation messages).
    await this.ensureParticipant(conversationId, authUser.sub);

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId: authUser.sub,
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
  }

  private assertCanAccessConsultation(
    authUser: AuthUser,
    consultation: {
      patient: { userId: string };
      physiotherapist: { userId: string };
    },
  ): void {
    if (authUser.role === UserRole.ADMIN) {
      return;
    }

    const isParticipant =
      consultation.patient.userId === authUser.sub ||
      consultation.physiotherapist.userId === authUser.sub;

    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this consultation.');
    }
  }

  private async assertCanAccessConversation(
    authUser: AuthUser,
    conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (authUser.role === UserRole.ADMIN) {
      return conversation;
    }

    const isParticipant = conversation.participants.some(
      (member) => member.userId === authUser.sub,
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this conversation.');
    }
    return conversation;
  }

  private async ensureParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!existing) {
      await this.prisma.conversationParticipant.create({
        data: {
          conversationId,
          userId,
        },
      });
    }
  }
}
