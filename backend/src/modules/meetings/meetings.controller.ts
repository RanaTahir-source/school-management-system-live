import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { AddAttendeesDto } from './dto/add-attendees.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'] as const;

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGE_ROLES)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Post()
  create(@Body() dto: CreateMeetingDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  // Open to anyone logged in - "meetings that involve me".
  @Get('mine')
  @Roles()
  mine(@CurrentUser() user: Requester) {
    return this.service.mine(user);
  }

  @Get()
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll(user, { schoolId, branchId, status, from, to });
  }

  @Get(':id')
  @Roles()
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMeetingDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/attendees')
  addAttendees(@Param('id') id: string, @Body() dto: AddAttendeesDto, @CurrentUser() user: ScopedUser) {
    return this.service.addAttendees(id, dto, user);
  }

  @Delete(':id/attendees/:userId')
  removeAttendee(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: ScopedUser) {
    return this.service.removeAttendee(id, userId, user);
  }

  @Patch(':id/attendees/:userId/attendance')
  markAttendance(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: ScopedUser,
  ) {
    return this.service.markAttendance(id, userId, dto, user);
  }
}
