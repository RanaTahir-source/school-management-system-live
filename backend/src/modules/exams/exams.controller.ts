import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto, UpdateExamDto } from './dto/create-exam.dto';
import { CreateExamSubjectDto, UpdateExamSubjectDto } from './dto/create-exam-subject.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(private readonly service: ExamsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateExamDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  // STUDENT included (read-only, own-school scoped by resolveSchoolScope)
  // so the mobile app can list exams before fetching a report card.
  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findAll(user, schoolId, academicYearId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateExamDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }

  // ── Papers (subject + class + max/passing marks) within an exam ──

  @Post(':examId/subjects')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  addSubject(
    @Param('examId') examId: string,
    @Body() dto: CreateExamSubjectDto,
    @CurrentUser() user: ScopedUser,
  ) {
    return this.service.addSubject(examId, dto, user);
  }

  @Get(':examId/subjects')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  listSubjects(
    @Param('examId') examId: string,
    @CurrentUser() user: ScopedUser,
    @Query('classId') classId?: string,
  ) {
    return this.service.listSubjects(examId, user, classId);
  }

  @Patch('subjects/:examSubjectId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  updateSubject(
    @Param('examSubjectId') examSubjectId: string,
    @Body() dto: UpdateExamSubjectDto,
    @CurrentUser() user: ScopedUser,
  ) {
    return this.service.updateSubject(examSubjectId, dto, user);
  }

  @Delete('subjects/:examSubjectId')
  @Roles('DIRECTOR', 'ADMIN')
  removeSubject(@Param('examSubjectId') examSubjectId: string, @CurrentUser() user: ScopedUser) {
    return this.service.removeSubject(examSubjectId, user);
  }
}
