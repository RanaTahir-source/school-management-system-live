import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffTasksService } from './staff-tasks.service';
import { CreateStaffTaskDto } from './dto/create-staff-task.dto';
import { UpdateStaffTaskDto } from './dto/update-staff-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'] as const;

@Controller('staff-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGE_ROLES)
export class StaffTasksController {
  constructor(private readonly service: StaffTasksService) {}

  @Post()
  create(@Body() dto: CreateStaffTaskDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  // Open to anyone logged in - "tasks assigned to me".
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
    @Query('priority') priority?: string,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.service.findAll(user, { schoolId, branchId, status, priority, assignedToId });
  }

  @Get(':id')
  @Roles()
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffTaskDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  // Open to anyone logged in - the assignee needs to mark their own task
  // done; the service itself enforces "assignee or manager only".
  @Patch(':id/status')
  @Roles()
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTaskStatusDto, @CurrentUser() user: Requester) {
    return this.service.updateStatus(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
