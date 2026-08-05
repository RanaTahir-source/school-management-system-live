import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/create-academic-year.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateAcademicYearDto, @CurrentUser() user: ScopedUser) {
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
  update(@Param('id') id: string, @Body() dto: UpdateAcademicYearDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
