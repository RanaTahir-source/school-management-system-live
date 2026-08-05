import { Module } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { SubjectsController } from './subjects.controller';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { ResultCardPdfService } from './result-card-pdf.service';

@Module({
  controllers: [SubjectsController, ExamsController, ResultsController],
  providers: [SubjectsService, ExamsService, ResultsService, ResultCardPdfService],
})
export class ExamsModule {}
