import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { AttendanceRegisterPdfService } from './attendance-register-pdf.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly pdfService: AttendanceRegisterPdfService,
  ) {}

  // Bulk-mark a whole section for one day. Class teachers can only mark
  // their own section; Director/Admin/Principal can mark any section.
  @Post('mark')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user: Requester) {
    return this.service.mark(dto, user);
  }

  // Mark-sheet view: every student in a section for a given date, status null if unmarked.
  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findBySection(
    @Query('sectionId') sectionId: string,
    @Query('date') date: string,
    @CurrentUser() user: Requester,
  ) {
    return this.service.findBySection(sectionId, date, user);
  }

  // One-page whole-school snapshot: total/boys/girls strength + present/absent/
  // late/leave counts for a given day, with a per-class breakdown table.
  @Get('school-report')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  schoolReport(
    @Query('schoolId') schoolId: string,
    @Query('date') date: string,
    @CurrentUser() user: Requester,
  ) {
    return this.service.schoolReport(schoolId, date, user);
  }

  // Per-student present/absent/late/leave totals + attendance % over a date range.
  @Get('summary')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  summary(
    @Query('sectionId') sectionId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: Requester,
  ) {
    return this.service.summary(sectionId, from, to, user);
  }

  // Month-view register for a section: every student x every day, plus totals.
  @Get('register')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  register(
    @Query('sectionId') sectionId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: Requester,
  ) {
    return this.service.register(sectionId, Number(year), Number(month), user);
  }

  // Same register, rendered as a printable landscape colour PDF.
  @Get('register/pdf')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  async registerPdf(
    @Query('sectionId') sectionId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: Requester,
    @Res() res: Response,
  ) {
    const data = await this.service.register(sectionId, Number(year), Number(month), user);
    const pdf = await this.pdfService.buildRegisterPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="attendance-register-${data.className}-${data.sectionName}-${data.year}-${data.month}.pdf"`,
    );
    res.send(pdf);
  }

  // A student may view their own history; staff can view anyone's (within their own school).
  @Get('student/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT')
  findByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser() user: Requester,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findByStudent(studentId, user, from, to);
  }
}
