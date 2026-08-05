import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Parent self-service: every route here is scoped to the caller's own
// linked children (checked via ParentStudent in the service) - there is no
// schoolId/staff-view path, this controller is PARENT-only by design.
@Controller('parent-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PARENT')
export class ParentPortalController {
  constructor(private readonly service: ParentPortalService) {}

  @Get('children')
  myChildren(@CurrentUser() user: { userId: string }) {
    return this.service.myChildren(user.userId);
  }

  // Combined fee ledger across all linked children - single totals if there's
  // only one child, family-wide totals + per-child breakdown if there's more.
  @Get('family-ledger')
  familyLedger(@CurrentUser() user: { userId: string }) {
    return this.service.familyLedger(user.userId);
  }

  @Get('children/:studentId/attendance')
  attendance(
    @Param('studentId') studentId: string,
    @CurrentUser() user: { userId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.attendance(user.userId, studentId, from, to);
  }

  @Get('children/:studentId/results')
  results(@Param('studentId') studentId: string, @CurrentUser() user: { userId: string }) {
    return this.service.results(user.userId, studentId);
  }

  @Get('children/:studentId/fees')
  fees(@Param('studentId') studentId: string, @CurrentUser() user: { userId: string }) {
    return this.service.fees(user.userId, studentId);
  }

  @Get('children/:studentId/homework')
  homework(@Param('studentId') studentId: string, @CurrentUser() user: { userId: string }) {
    return this.service.homeworkFor(user.userId, studentId);
  }

  @Get('children/:studentId/online-classes')
  onlineClasses(@Param('studentId') studentId: string, @CurrentUser() user: { userId: string }) {
    return this.service.onlineClassesFor(user.userId, studentId);
  }
}
