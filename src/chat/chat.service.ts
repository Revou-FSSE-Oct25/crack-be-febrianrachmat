import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

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

    return this.prisma.conversation.create({
      data: {
        consultationId: consultation.id,
        participants: {
          create: [
            { userId: consultation.patient.userId },
            { userId: consultation.physiotherapist.userId },
          ],
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        messages: true,
      },
    });
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
    await this.assertCanAccessConversation(authUser, conversationId);

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
  ): Promise<void> {
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
      return;
    }

    const isParticipant = conversation.participants.some(
      (member) => member.userId === authUser.sub,
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this conversation.');
    }
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
