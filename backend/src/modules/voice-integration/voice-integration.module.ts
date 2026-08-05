import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VoiceIntegrationController } from './voice-integration.controller';
import { VoiceIntegrationService } from './voice-integration.service';

@Module({
  imports: [PrismaModule],
  controllers: [VoiceIntegrationController],
  providers: [VoiceIntegrationService],
})
export class VoiceIntegrationModule {}
