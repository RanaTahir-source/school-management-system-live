import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatCallService } from './chat-call.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { AddThreadMembersDto } from './dto/add-thread-members.dto';
import { JoinCallDto } from './dto/join-call.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

// Chat is open to every authenticated role - a class WhatsApp-style group
// naturally includes parents, teachers, principal, etc. Only creating a
// BROADCAST thread is restricted, enforced inside ChatService, not here.
@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly chatCallService: ChatCallService,
  ) {}

  @Post('threads')
  createGroup(@Body() dto: CreateThreadDto, @CurrentUser() user: Requester) {
    return this.chatService.createGroup(dto, user);
  }

  @Post('threads/direct/:userId')
  findOrCreateDirect(@Param('userId') userId: string, @CurrentUser() user: Requester) {
    return this.chatService.findOrCreateDirect(userId, user);
  }

  @Post('threads/section/:sectionId')
  getOrCreateSectionGroup(@Param('sectionId') sectionId: string, @CurrentUser() user: Requester) {
    return this.chatService.getOrCreateSectionGroup(sectionId, user);
  }

  @Get('threads')
  myThreads(@CurrentUser() user: Requester) {
    return this.chatService.myThreads(user);
  }

  @Get('threads/:id/messages')
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: Requester,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(id, user, { before, limit: limit ? Number(limit) : undefined });
  }

  @Post('threads/:id/messages')
  async sendMessage(@Param('id') id: string, @Body() dto: SendChatMessageDto, @CurrentUser() user: Requester) {
    const message = await this.chatService.sendMessage(id, dto, user);
    this.chatGateway.broadcastMessage(id, message);
    return message;
  }

  @Patch('threads/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.chatService.markRead(id, user);
  }

  @Post('threads/:id/members')
  addMembers(@Param('id') id: string, @Body() dto: AddThreadMembersDto, @CurrentUser() user: Requester) {
    return this.chatService.addMembers(id, dto, user);
  }

  @Delete('threads/:id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: Requester) {
    return this.chatService.removeMember(id, userId, user);
  }

  @Get('threads/:id/call')
  getCallStatus(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.chatCallService.getStatus(id, user);
  }

  @Post('threads/:id/call/join')
  joinCall(@Param('id') id: string, @Body() dto: JoinCallDto, @CurrentUser() user: Requester) {
    return this.chatCallService.joinCall(id, user, { withNotetaker: dto?.withNotetaker });
  }

  @Post('threads/:id/call/end')
  endCall(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.chatCallService.endCall(id, user);
  }
}
