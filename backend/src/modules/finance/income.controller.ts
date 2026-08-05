import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IncomeService } from './income.service';
import { FinancePdfReportService } from './finance-pdf-report.service';
import { FeeExtraReportService } from './fee-extra-report.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = { userId: string } & ScopedUser;

@Controller('income')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncomeController {
  constructor(
    private readonly service: IncomeService,
    private readonly pdfReportService: FinancePdfReportService,
    private readonly extraReportService: FeeExtraReportService,
  ) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  create(@Body() dto: CreateIncomeDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findAll(
    @CurrentUser() user: Requester,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll(user, { schoolId, branchId, category, from, to });
  }

  // Security deposit records - GET /income/security-deposits.pdf?schoolId=
  // Must be declared before ":id"/":id/voucher.pdf" so it isn't swallowed by those.
  @Get('security-deposits.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async securityDeposits(@CurrentUser() user: Requester, @Res() res: Response, @Query('schoolId') schoolId?: string) {
    const records = await this.service.findSecurityDeposits(user, schoolId);
    const schoolNames = new Set(records.map((r) => r.school.name));
    const schoolLabel = schoolNames.size === 1 ? [...schoolNames][0] : 'All Schools';
    const pdf = await this.extraReportService.buildSecurityDepositPdf(records as any, schoolLabel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="security-deposits.pdf"');
    res.send(pdf);
  }

  @Get(':id/voucher.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async voucher(@Param('id') id: string, @CurrentUser() user: Requester, @Res() res: Response) {
    const record = await this.service.findOneWithRelations(id, user);
    const pdf = await this.pdfReportService.buildVoucherPdf({
      kind: 'INCOME',
      schoolName: record.school.name,
      branchName: record.branch?.name ?? null,
      category: record.category,
      amount: record.amount,
      date: record.date,
      description: record.description,
      recordedByName: record.receivedBy.fullName,
      studentName: record.student?.user.fullName ?? null,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="income-voucher.pdf"');
    res.send(pdf);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findOne(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  update(@Param('id') id: string, @Body() dto: UpdateIncomeDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.remove(id, user);
  }
}
