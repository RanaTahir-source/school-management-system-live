import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FeeHeadService } from './fee-head.service';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { UpdateFeeHeadDto } from './dto/update-fee-head.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('finance/fee-heads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeeHeadController {
  constructor(private readonly service: FeeHeadService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  create(@Body() dto: CreateFeeHeadDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  update(@Param('id') id: string, @Body() dto: UpdateFeeHeadDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
