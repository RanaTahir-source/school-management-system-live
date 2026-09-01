import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AiQuestionPaperService } from './ai-question-paper.service';
import { AiLessonPlanService } from './ai-lesson-plan.service';
import { AiDocumentPdfService } from './ai-document-pdf.service';
import { GenerateQuestionPaperDto } from './dto/generate-question-paper.dto';
import { GenerateLessonPlanDto } from './dto/generate-lesson-plan.dto';
import { UpdateAiDocumentDto } from './dto/update-ai-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const TEACHING_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'] as const;

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TEACHING_ROLES)
export class AiController {
  constructor(
    private readonly questionPapers: AiQuestionPaperService,
    private readonly lessonPlans: AiLessonPlanService,
    private readonly pdf: AiDocumentPdfService,
  ) {}

  // ── Question Paper Generator ─────────────────────────────────────────
  @Post('question-papers/generate')
  generateQuestionPaper(@Body() dto: GenerateQuestionPaperDto, @CurrentUser() user: Requester) {
    return this.questionPapers.generate(dto, user);
  }

  @Get('question-papers')
  findAllQuestionPapers(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.questionPapers.findAll(user, { schoolId, subjectId, classId });
  }

  @Get('question-papers/:id')
  findOneQuestionPaper(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.questionPapers.findOne(id, user);
  }

  @Patch('question-papers/:id')
  updateQuestionPaper(@Param('id') id: string, @Body() dto: UpdateAiDocumentDto, @CurrentUser() user: ScopedUser) {
    return this.questionPapers.update(id, dto, user);
  }

  @Delete('question-papers/:id')
  removeQuestionPaper(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.questionPapers.remove(id, user);
  }

  @Get('question-papers/:id/pdf')
  async questionPaperPdf(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const paper = await this.questionPapers.findOne(id, user);
    const buffer = await this.pdf.buildQuestionPaperPdf(
      {
        title: paper.title,
        schoolName: (paper as any).school?.name ?? 'School',
        examType: paper.examType,
        subjectName: (paper as any).subject?.name ?? null,
        className: (paper as any).class?.name ?? null,
        totalMarks: paper.totalMarks,
        durationMinutes: paper.durationMinutes,
        instructions: paper.instructions,
      },
      paper.content as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${paper.title.replace(/[^a-z0-9]/gi, '-')}.pdf"`);
    res.send(buffer);
  }

  // ── Lesson Plan Generator ────────────────────────────────────────────
  @Post('lesson-plans/generate')
  generateLessonPlan(@Body() dto: GenerateLessonPlanDto, @CurrentUser() user: Requester) {
    return this.lessonPlans.generate(dto, user);
  }

  @Get('lesson-plans')
  findAllLessonPlans(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.lessonPlans.findAll(user, { schoolId, subjectId, classId });
  }

  @Get('lesson-plans/:id')
  findOneLessonPlan(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.lessonPlans.findOne(id, user);
  }

  @Patch('lesson-plans/:id')
  updateLessonPlan(@Param('id') id: string, @Body() dto: UpdateAiDocumentDto, @CurrentUser() user: ScopedUser) {
    return this.lessonPlans.update(id, dto, user);
  }

  @Delete('lesson-plans/:id')
  removeLessonPlan(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.lessonPlans.remove(id, user);
  }

  @Get('lesson-plans/:id/pdf')
  async lessonPlanPdf(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const plan = await this.lessonPlans.findOne(id, user);
    const buffer = await this.pdf.buildLessonPlanPdf(
      {
        topic: plan.topic,
        schoolName: (plan as any).school?.name ?? 'School',
        subjectName: (plan as any).subject?.name ?? null,
        className: (plan as any).class?.name ?? null,
        durationMinutes: plan.durationMinutes,
      },
      plan.content as any,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${plan.topic.replace(/[^a-z0-9]/gi, '-')}.pdf"`);
    res.send(buffer);
  }
}
