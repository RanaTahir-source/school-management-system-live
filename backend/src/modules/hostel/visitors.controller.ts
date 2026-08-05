import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { LogVisitorDto } from './dto/log-visitor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('hostel/visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitorsController {
  constructor(private readonly service: VisitorsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  checkIn(@Body() dto: LogVisitorDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.checkIn(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string, @Query('studentId') studentId?: string) {
    return this.service.findAll(user, schoolId, studentId);
  }

  @Patch(':id/checkout')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  checkOut(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.checkOut(id, user);
  }
}
