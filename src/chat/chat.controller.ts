import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatService } from './chat.service';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

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
  listMyConversations(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.chatService.listMyConversations(req.user as AuthUser, query);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'List conversation messages' })
  listMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query() query: PaginationQueryDto,
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
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      req.user as AuthUser,
      conversationId,
      dto,
    );
  }
}
