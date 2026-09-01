import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatCallService } from './chat-call.service';
import { LivekitService } from './livekit.service';
import { AiFallbackController } from './ai-fallback.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ChatController, AiFallbackController],
  providers: [ChatService, ChatGateway, ChatCallService, LivekitService],
})
export class ChatModule {}
