import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StudyMaterialsService } from './study-materials.service';
import { CreateStudyMaterialDto, UpdateStudyMaterialDto } from './dto/create-study-material.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// The "digital library" - teacher-shared notes/video links, filterable by
// class/subject. fileUrl is an external link (Drive/YouTube); there's no
// file-storage provider wired up yet for direct uploads.
@Controller('library/materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudyMaterialsController {
  constructor(private readonly service: StudyMaterialsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  create(@Body() dto: CreateStudyMaterialDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.findAll(user, schoolId, classId, subjectId);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  update(@Param('id') id: string, @Body() dto: UpdateStudyMaterialDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
