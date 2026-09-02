import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// Fee/attendance/exam/teacher dashboards are management-facing; CHAIRMAN can
// view any single school's by passing ?schoolId=, everyone else always sees
// their own school automatically (enforced inside the service).
const DASHBOARD_ROLES = ['CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'];
const LEARNING_REPORT_ROLES = [...DASHBOARD_ROLES, 'TEACHER', 'STUDENT', 'PARENT'];

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('fee-default-risk')
  @Roles(...DASHBOARD_ROLES)
  feeDefaultRisk(@Query('schoolId') schoolId: string | undefined, @CurrentUser() user: ScopedUser) {
    return this.service.feeDefaultRisk(user, schoolId);
  }

  @Get('attendance-anomalies')
  @Roles(...DASHBOARD_ROLES)
  attendanceAnomalies(@Query('schoolId') schoolId: string | undefined, @CurrentUser() user: ScopedUser) {
    return this.service.attendanceAnomalies(user, schoolId);
  }

  @Get('exam-risk')
  @Roles(...DASHBOARD_ROLES)
  examRiskScoring(@Query('schoolId') schoolId: string | undefined, @CurrentUser() user: ScopedUser) {
    return this.service.examRiskScoring(user, schoolId);
  }

  @Get('teacher-efficiency')
  @Roles(...DASHBOARD_ROLES)
  teacherEfficiency(@Query('schoolId') schoolId: string | undefined, @CurrentUser() user: ScopedUser) {
    return this.service.teacherEfficiency(user, schoolId);
  }

  // A student/parent's own auto-generated report - resolves the student
  // without the caller needing to know any IDs.
  @Get('learning-report/mine')
  @Roles('STUDENT')
  myLearningReport(@CurrentUser() user: ScopedUser) {
    return this.service.myLearningReport(user);
  }

  // A specific student's report - for staff (same-school), the student
  // themself, or that student's linked parent (checked inside the service).
  @Get('learning-report/:studentId')
  @Roles(...LEARNING_REPORT_ROLES)
  learningReport(@Param('studentId') studentId: string, @CurrentUser() user: ScopedUser) {
    return this.service.learningReport(user, studentId);
  }
}
