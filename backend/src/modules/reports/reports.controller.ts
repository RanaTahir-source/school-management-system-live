import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { toCsv } from '../../common/utils/csv';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // ── Admissions ──
  @Get('admissions')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  admissions(
    @CurrentUser() user: ScopedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.service.admissions(user, from, to, schoolId, branchId, classId);
  }

  @Get('admissions.csv')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async admissionsCsv(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('classId') classId?: string,
  ) {
    const data = await this.service.admissions(user, from, to, schoolId, branchId, classId);
    const csv = toCsv(data.students, [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'className', label: 'Class' },
      { key: 'sectionName', label: 'Section' },
      { key: 'admissionDate', label: 'Admission Date' },
      { key: 'guardianName', label: 'Guardian Name' },
      { key: 'guardianPhone', label: 'Guardian Phone' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admissions-report.csv"');
    res.send(csv);
  }

  // ── Student directory ──
  @Get('students')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  studentDirectory(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.service.studentDirectory(user, schoolId, classId, sectionId);
  }

  @Get('students.csv')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async studentDirectoryCsv(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    const rows = await this.service.studentDirectory(user, schoolId, classId, sectionId);
    const csv = toCsv(rows, [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'className', label: 'Class' },
      { key: 'sectionName', label: 'Section' },
      { key: 'guardianName', label: 'Guardian Name' },
      { key: 'guardianPhone', label: 'Guardian Phone' },
      { key: 'admissionDate', label: 'Admission Date' },
      { key: 'status', label: 'Status' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="student-directory.csv"');
    res.send(csv);
  }

  // ── Staff directory ──
  @Get('staff')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  staffDirectory(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.staffDirectory(user, schoolId);
  }

  @Get('staff.csv')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async staffDirectoryCsv(@CurrentUser() user: ScopedUser, @Res() res: Response, @Query('schoolId') schoolId?: string) {
    const rows = await this.service.staffDirectory(user, schoolId);
    const csv = toCsv(rows, [
      { key: 'fullName', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'category', label: 'Category' },
      { key: 'designation', label: 'Designation' },
      { key: 'joiningDate', label: 'Joining Date' },
      { key: 'basicPay', label: 'Basic Pay' },
      { key: 'status', label: 'Status' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="staff-directory.csv"');
    res.send(csv);
  }

  // ── Cross-exam performance trend ──
  @Get('performance-trend')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  performanceTrend(
    @CurrentUser() user: ScopedUser,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.performanceTrend(user, classId, academicYearId);
  }
}
