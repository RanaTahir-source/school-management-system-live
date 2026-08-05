import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { MarkStudentLeftDto } from './dto/mark-student-left.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: ScopedUser) {
    return this.studentsService.create(dto, user);
  }

  // status: omit for current students only, "ALL" for everyone, or a specific
  // EnrollmentStatus (e.g. "LEFT") for the alumni/left-students list.
  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
  ) {
    return this.studentsService.findAll(user, sectionId, status);
  }

  // Must be declared before ':id' - otherwise Express would match "me" as an :id param.
  // Lets a STUDENT-role user resolve their own studentProfileId after login
  // (there is no other way for a student to discover it, since GET / and
  // GET /:id are staff-only).
  @Get('me')
  @Roles('STUDENT')
  findMe(@CurrentUser() user: Requester) {
    return this.studentsService.findMe(user.userId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.studentsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: ScopedUser) {
    return this.studentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.studentsService.remove(id, user);
  }

  // Marks a student LEFT/GRADUATED/TRANSFERRED/EXPELLED - keeps their history
  // (fees/attendance/results) intact, just moves them out of the current-
  // students list. Different from DELETE, which is for mistaken entries.
  @Patch(':id/leave')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  markLeft(
    @Param('id') id: string,
    @Body() dto: MarkStudentLeftDto,
    @CurrentUser() user: ScopedUser & { userId: string },
  ) {
    return this.studentsService.markLeft(id, dto, user);
  }

  @Patch(':id/reactivate')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  reactivate(@Param('id') id: string, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.studentsService.reactivate(id, user);
  }
}
