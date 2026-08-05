import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly service: SchoolsService) {}

  // Chairman-only escape hatch - normal tenant onboarding is /platform/directors
  // then a Director calling POST /schools/mine below.
  @Post()
  @Roles('CHAIRMAN')
  create(@Body() dto: CreateSchoolDto) {
    return this.service.create(dto);
  }

  // A Director (created via /platform/directors, no school yet) creates
  // their own school. After this succeeds, the caller must POST /auth/refresh
  // to get an access token that reflects the newly-assigned schoolId.
  @Post('mine')
  @Roles('DIRECTOR')
  createMine(@Body() dto: CreateSchoolDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.createMine(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
  findAll(@CurrentUser() user: ScopedUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
