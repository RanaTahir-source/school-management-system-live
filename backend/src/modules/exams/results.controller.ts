import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ResultsService } from './results.service';
import { ResultCardPdfService } from './result-card-pdf.service';
import { MarkResultsDto } from './dto/mark-results.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

@Controller('results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsController {
  constructor(
    private readonly service: ResultsService,
    private readonly pdfService: ResultCardPdfService,
  ) {}

  // Bulk-enter marks for a whole class in one paper.
  @Post('mark')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  mark(@Body() dto: MarkResultsDto, @CurrentUser() user: Requester) {
    return this.service.mark(dto, user);
  }

  // Mark-sheet for one paper: every student in that class + marks (null if unmarked).
  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findByExamSubject(@Query('examSubjectId') examSubjectId: string, @CurrentUser() user: Requester) {
    return this.service.findByExamSubject(examSubjectId, user);
  }

  // One-page class result sheet: every student's total/%/grade for an exam.
  @Get('class-summary')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  classSummary(
    @Query('examId') examId: string,
    @Query('classId') classId: string,
    @CurrentUser() user: Requester,
  ) {
    return this.service.classSummary(examId, classId, user);
  }

  // Full report card for one student in one exam. Student can view their own
  // only; Parent can view their linked children's (checked in the service).
  @Get('report-card/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  reportCard(
    @Param('studentId') studentId: string,
    @Query('examId') examId: string,
    @CurrentUser() user: Requester,
  ) {
    return this.service.reportCard(studentId, examId, user);
  }

  // Same report card, rendered as a printable colour PDF.
  @Get('report-card/:studentId/pdf')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
  async reportCardPdf(
    @Param('studentId') studentId: string,
    @Query('examId') examId: string,
    @CurrentUser() user: Requester,
    @Res() res: Response,
  ) {
    const data = await this.service.reportCard(studentId, examId, user);
    const pdf = await this.pdfService.buildReportCardPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="report-card-${data.admissionNo}.pdf"`);
    res.send(pdf);
  }
}
