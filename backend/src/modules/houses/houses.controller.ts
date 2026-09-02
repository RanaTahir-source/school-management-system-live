import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { HousesService } from './houses.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/create-house.dto';
import { AwardHousePointsDto, AssignHouseDto } from './dto/award-house-points.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'];
// Everyone likes seeing the house leaderboard - it's a school-wide
// gamification feature, not a management tool.
const VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT'];

@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousesController {
  constructor(private readonly service: HousesService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateHouseDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateHouseDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/points')
  @Roles(...MANAGE_ROLES)
  awardPoints(@Param('id') id: string, @Body() dto: AwardHousePointsDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.awardPoints(id, dto, user);
  }

  // Assign (or clear, with houseId: null) one student's house.
  @Patch('students/:studentId')
  @Roles(...MANAGE_ROLES)
  assignStudent(@Param('studentId') studentId: string, @Body() dto: AssignHouseDto, @CurrentUser() user: ScopedUser) {
    return this.service.assignStudent(studentId, dto, user);
  }
}
