import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('transport/vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateVehicleDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string, @Query('branchId') branchId?: string) {
    return this.service.findAll(user, schoolId, branchId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
