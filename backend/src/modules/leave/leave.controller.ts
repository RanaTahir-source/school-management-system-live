import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveStatus } from '@prisma/client';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

@Controller('leave-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  // Any authenticated role can apply for their own leave.
  @Post()
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  @Patch(':id/review')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  review(@Param('id') id: string, @Body() dto: ReviewLeaveRequestDto, @CurrentUser() user: Requester) {
    return this.service.review(id, dto, user);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.cancel(id, user);
  }

  // Staff-wide list, e.g. for a Principal's approval queue.
  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(@Query('status') status: LeaveStatus | undefined, @CurrentUser() user: Requester) {
    return this.service.findAll(user, status);
  }

  @Get('mine')
  findMine(@CurrentUser() user: Requester) {
    return this.service.findMine(user);
  }
}
