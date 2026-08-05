import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SalaryStructureService } from './salary-structure.service';
import { UpsertSalaryStructureDto } from './dto/upsert-salary-structure.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('payroll/salary-structures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryStructureController {
  constructor(private readonly service: SalaryStructureService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  upsert(@Body() dto: UpsertSalaryStructureDto, @CurrentUser() user: ScopedUser) {
    return this.service.upsert(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Get('staff/:staffId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findForStaff(@Param('staffId') staffId: string, @CurrentUser() user: ScopedUser) {
    return this.service.findForStaff(staffId, user);
  }
}
