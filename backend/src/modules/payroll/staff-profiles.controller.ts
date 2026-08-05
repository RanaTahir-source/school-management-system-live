import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffProfilesService } from './staff-profiles.service';
import { CreateStaffProfileDto, UpdateStaffProfileDto } from './dto/create-staff-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// Attaches HR/payroll details (employee ID, designation, basic pay, etc.) to
// an existing user account. This never creates a login - use Staff & Users
// or Teachers to create the account first, then register it here so it can
// be paid through Payroll.
@Controller('payroll/staff-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffProfilesController {
  constructor(private readonly service: StaffProfilesService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateStaffProfileDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Get('eligible-users')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  eligibleUsers(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.eligibleUsers(user, schoolId);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateStaffProfileDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
