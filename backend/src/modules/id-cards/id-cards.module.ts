import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdCardsController } from './id-cards.controller';
import { IdCardsService } from './id-cards.service';
import { IdCardPdfService } from './id-card-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [IdCardsController],
  providers: [IdCardsService, IdCardPdfService],
  exports: [IdCardPdfService],
})
export class IdCardsModule {}
