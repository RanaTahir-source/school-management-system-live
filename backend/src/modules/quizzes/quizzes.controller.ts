import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto, UpdateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'] as const;

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly service: QuizzesService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateQuizDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(...MANAGE_ROLES)
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.findAll(user, { schoolId, classId, sectionId, subjectId });
  }

  // ---- Student-facing routes - declared before ':id' so they aren't
  // swallowed by the dynamic param route below. ----

  @Get('available')
  @Roles('STUDENT')
  availableForMe(@CurrentUser() user: ScopedUser) {
    return this.service.availableForMe(user);
  }

  @Get(':id')
  @Roles(...MANAGE_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateQuizDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }

  @Get(':id/attempts')
  @Roles(...MANAGE_ROLES)
  attemptsForQuiz(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.attemptsForQuiz(id, user);
  }

  @Post(':id/attempts/start')
  @Roles('STUDENT')
  startAttempt(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.startAttempt(id, user);
  }

  @Post(':id/attempts/submit')
  @Roles('STUDENT')
  submitAttempt(@Param('id') id: string, @Body() dto: SubmitQuizDto, @CurrentUser() user: ScopedUser) {
    return this.service.submitAttempt(id, dto, user);
  }

  @Get(':id/attempts/me')
  @Roles('STUDENT')
  myResult(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.myResult(id, user);
  }
}
