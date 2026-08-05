import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AllocationsService } from './allocations.service';
import { AllocateRoomDto, VacateRoomDto } from './dto/allocate-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('hostel/allocations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AllocationsController {
  constructor(private readonly service: AllocationsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  allocate(@Body() dto: AllocateRoomDto, @CurrentUser() user: ScopedUser) {
    return this.service.allocate(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('roomId') roomId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findAll(user, schoolId, roomId, isActive);
  }

  // A student checking their own current/past room allocations.
  @Get('mine')
  mine(@CurrentUser() user: { userId: string }) {
    return this.service.mine(user.userId);
  }

  @Patch(':id/vacate')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  vacate(@Param('id') id: string, @Body() dto: VacateRoomDto, @CurrentUser() user: ScopedUser) {
    return this.service.vacate(id, dto, user);
  }
}
