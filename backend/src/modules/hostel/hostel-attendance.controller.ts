import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HostelAttendanceService } from './hostel-attendance.service';
import { MarkHostelAttendanceDto } from './dto/mark-hostel-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('hostel/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HostelAttendanceController {
  constructor(private readonly service: HostelAttendanceService) {}

  @Post('mark')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  mark(@Body() dto: MarkHostelAttendanceDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.mark(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findByDate(@CurrentUser() user: ScopedUser, @Query('date') date: string, @Query('schoolId') schoolId?: string) {
    return this.service.findByDate(user, date, schoolId);
  }

  // A student may view their own hostel attendance history; staff can view anyone's.
  @Get('student/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'STUDENT')
  findByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser() user: ScopedUser & { userId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findByStudent(studentId, user, from, to);
  }
}
