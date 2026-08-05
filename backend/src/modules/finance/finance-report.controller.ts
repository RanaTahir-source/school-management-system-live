import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FinanceReportService } from './finance-report.service';
import { FinancePdfReportService } from './finance-pdf-report.service';
import { FeeExtraReportService } from './fee-extra-report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceReportController {
  constructor(
    private readonly service: FinanceReportService,
    private readonly pdfReportService: FinancePdfReportService,
    private readonly extraReportService: FeeExtraReportService,
  ) {}

  // Dashboard widget - GET /finance/dashboard-summary
  // Lifetime income/expense/net balance, per school the caller can see, plus
  // one combined total. No query params: schools are resolved from the
  // caller's own access (every campus for Director/Admin).
  @Get('dashboard-summary')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  dashboardSummary(@CurrentUser() user: ScopedUser) {
    return this.service.dashboardSummary(user);
  }

  // Income vs. expense report for a date range (e.g. one month), per "mad"
  // (category), broken down branch-wise - GET /finance/report?schoolId=&from=&to=
  @Get('report')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  report(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.report(user, schoolId, from, to);
  }

  // Printable version of the same report (mirrors the old VFP
  // "profit_and_loss" report) - GET /finance/report.pdf?schoolId=&from=&to=
  @Get('report.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async reportPdf(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const data = await this.service.report(user, schoolId, from, to);
    const pdf = await this.pdfReportService.buildStatementPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="income-expense-statement.pdf"');
    res.send(pdf);
  }

  // Cumulative balance sheet as of one date - GET /finance/balance-sheet.pdf?schoolId=&asOfDate=YYYY-MM-DD
  @Get('balance-sheet.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async balanceSheetPdf(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId: string,
    @Query('asOfDate') asOfDate: string,
  ) {
    const data = await this.service.balanceSheet(user, schoolId, asOfDate);
    const pdf = await this.extraReportService.buildBalanceSheetPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="balance-sheet-${asOfDate}.pdf"`);
    res.send(pdf);
  }
}
