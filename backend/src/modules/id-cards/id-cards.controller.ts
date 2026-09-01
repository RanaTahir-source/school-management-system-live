import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IdCardsService } from './id-cards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// All routes return a PDF inline (not as an attachment) so the browser's
// print dialog can be opened directly - the same convention as fee receipts
// and result cards.
function sendPdf(res: Response, buffer: Buffer, fileName: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.send(buffer);
}

@Controller('id-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IdCardsController {
  constructor(private readonly service: IdCardsService) {}

  @Get('students/:id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async studentCard(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const pdf = await this.service.studentCard(id, user);
    sendPdf(res, pdf, `student-id-card-${id}.pdf`);
  }

  @Get('teachers/:id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async teacherCard(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const pdf = await this.service.teacherCard(id, user);
    sendPdf(res, pdf, `teacher-id-card-${id}.pdf`);
  }

  // Whole-section print sheet, e.g. before a new term starts.
  @Get('students/batch/section/:sectionId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  async studentBatch(@Param('sectionId') sectionId: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const pdf = await this.service.studentBatchBySection(sectionId, user);
    sendPdf(res, pdf, `student-id-cards-section-${sectionId}.pdf`);
  }

  // Whole-branch (one campus) print sheet.
  @Get('teachers/batch/branch/:branchId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async teacherBatchByBranch(@Param('branchId') branchId: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const pdf = await this.service.teacherBatchByBranch(branchId, user);
    sendPdf(res, pdf, `teacher-id-cards-branch-${branchId}.pdf`);
  }

  // Whole-school (every branch) print sheet.
  @Get('teachers/batch/school')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'CHAIRMAN')
  async teacherBatchBySchool(@Query('schoolId') schoolId: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const pdf = await this.service.teacherBatchBySchool(schoolId, user);
    sendPdf(res, pdf, `teacher-id-cards-school-${schoolId}.pdf`);
  }
}
