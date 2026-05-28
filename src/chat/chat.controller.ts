import {
  Body,
  Controller,
  Get,
  Header,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipEnvelope } from '../common/decorators/skip-envelope.decorator';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatService } from './chat.service';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { StreamMessagesQueryDto } from './dto/stream-messages-query.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Post('conversations')
  @ApiOperation({ summary: 'Create or get conversation by consultation' })
  createOrGetConversation(
    @Req() req: Request,
    @Body() dto: CreateOrGetConversationDto,
  ) {
    return this.chatService.createOrGetConversation(req.user as AuthUser, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('conversations')
  @ApiOperation({ summary: 'List conversations by current actor' })
  listMyConversations(
    @Req() req: Request,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.chatService.listMyConversations(req.user as AuthUser, query);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @SkipEnvelope()
  @Sse('conversations/:conversationId/messages/stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Stream new messages (SSE)',
    description:
      'Long-lived `text/event-stream`. Pass `since` (ISO) for the newest message already on the client. Events: default `message` with JSON body; `ping` keep-alive every 30s.',
  })
  streamMessages(
    @Req() req: Request,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: StreamMessagesQueryDto,
  ): Observable<MessageEvent> {
    return this.chatService.streamMessages(
      req.user as AuthUser,
      conversationId,
      query,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'List conversation messages' })
  listMessages(
    @Req() req: Request,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chatService.listMessages(
      req.user as AuthUser,
      conversationId,
      query,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Send message to conversation' })
  sendMessage(
    @Req() req: Request,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      req.user as AuthUser,
      conversationId,
      dto,
    );
  }
}
