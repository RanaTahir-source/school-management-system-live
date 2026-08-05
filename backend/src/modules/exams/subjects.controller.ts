import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/create-subject.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateSubjectDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateSubjectDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
