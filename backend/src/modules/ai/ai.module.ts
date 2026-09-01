import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiQuestionPaperService } from './ai-question-paper.service';
import { AiLessonPlanService } from './ai-lesson-plan.service';
import { AiDocumentPdfService } from './ai-document-pdf.service';
import { AnthropicClientService } from './anthropic-client.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiQuestionPaperService, AiLessonPlanService, AiDocumentPdfService, AnthropicClientService],
})
export class AiModule {}
