import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateTeacherDto, @CurrentUser() user: ScopedUser) {
    return this.teachersService.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(@CurrentUser() user: ScopedUser) {
    return this.teachersService.findAll(user);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.teachersService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto, @CurrentUser() user: ScopedUser) {
    return this.teachersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.teachersService.remove(id, user);
  }
}
