import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';

type ChatUser = { userId: string; roles: string[]; schoolId: string | null };
type AuthedSocket = Socket & { data: { user?: ChatUser } };

// Real-time layer for chat. Deliberately thin - all membership/permission
// rules live in ChatService (same checks the REST controller uses), so a
// socket can never do anything the REST API wouldn't also allow.
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // Auth happens once, at connection time, via a JWT passed in the socket.io
  // handshake (client sets `auth: { token }` when connecting) - the same
  // access token issued by /auth/login, verified with the same secret the
  // HTTP JwtStrategy uses.
  handleConnection(client: AuthedSocket) {
    try {
      const token = (client.handshake.auth?.token as string) || (client.handshake.query?.token as string);
      if (!token) throw new Error('No token provided');
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as {
        sub: string;
        roles: string[];
        schoolId: string | null;
      };
      client.data.user = { userId: payload.sub, roles: payload.roles, schoolId: payload.schoolId ?? null };
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    // socket.io removes the socket from every room automatically - nothing
    // to clean up on our side.
  }

  @SubscribeMessage('joinThread')
  async joinThread(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { threadId: string }) {
    const user = client.data.user;
    if (!user || !data?.threadId) return;
    try {
      await this.chatService.getMessages(data.threadId, user, { limit: 1 });
      client.join(`thread:${data.threadId}`);
      client.emit('joinedThread', { threadId: data.threadId });
    } catch {
      client.emit('errorEvent', { message: 'Cannot join this conversation' });
    }
  }

  @SubscribeMessage('leaveThread')
  leaveThread(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { threadId: string }) {
    if (data?.threadId) client.leave(`thread:${data.threadId}`);
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { threadId: string; body: string; attachmentUrl?: string },
  ) {
    const user = client.data.user;
    if (!user || !data?.threadId) return;
    try {
      const message = await this.chatService.sendMessage(data.threadId, { body: data.body, attachmentUrl: data.attachmentUrl }, user);
      this.broadcastMessage(data.threadId, message);
    } catch (err) {
      client.emit('errorEvent', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { threadId: string }) {
    const user = client.data.user;
    if (!user || !data?.threadId) return;
    client.to(`thread:${data.threadId}`).emit('typing', { threadId: data.threadId, userId: user.userId });
  }

  // Also called by ChatController after a REST-sent message, so clients that
  // haven't opened a socket (or sent via HTTP fallback) still notify anyone
  // who has an active connection to this thread.
  broadcastMessage(threadId: string, message: unknown) {
    this.server.to(`thread:${threadId}`).emit('newMessage', { threadId, message });
  }

  // Lets connected clients refresh their "ongoing call" banner instantly
  // instead of waiting for their next poll.
  broadcastCallEvent(threadId: string, event: 'started' | 'ended') {
    this.server.to(`thread:${threadId}`).emit('callEvent', { threadId, event });
  }
}
