import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PayslipsService } from './payslips.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { PayPayslipDto } from './dto/pay-payslip.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('payroll/payslips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayslipsController {
  constructor(private readonly service: PayslipsService) {}

  @Post('generate')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  generate(@Body() dto: GeneratePayrollDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.generate(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user, schoolId, period, status);
  }

  // A staff member checking their own payslip history - no @Roles
  // restriction, ownership is implicit (looked up by the caller's own userId).
  @Get('mine')
  mine(@CurrentUser() user: { userId: string }) {
    return this.service.mine(user.userId);
  }

  // Staff-view: DIRECTOR/ADMIN/ACCOUNTANT/PRINCIPAL can look up anyone in
  // their school; a lookup by any other authenticated role only succeeds if
  // it's the caller's own staffId (see STAFF_VIEW_ROLES check in the
  // service) - use /mine instead for that case, this route mainly exists
  // for staff-directory drill-down.
  @Get('staff/:staffId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findForStaff(@Param('staffId') staffId: string, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.findForStaff(staffId, user);
  }

  @Patch(':id/pay')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  pay(@Param('id') id: string, @Body() dto: PayPayslipDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.pay(id, dto, user);
  }
}
