import { Controller, Get, Param, Post, Body, Query, Res, UseGuards, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { FeeInvoiceService } from './fee-invoice.service';
import { FeeDuesReportService } from './fee-dues-report.service';
import { FeeLedgerReportService } from './fee-ledger-report.service';
import { FeeSummaryReportService } from './fee-summary-report.service';
import { FeeExtraReportService } from './fee-extra-report.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('finance/fee-invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeeInvoiceController {
  constructor(
    private readonly service: FeeInvoiceService,
    private readonly duesReportService: FeeDuesReportService,
    private readonly ledgerReportService: FeeLedgerReportService,
    private readonly summaryReportService: FeeSummaryReportService,
    private readonly extraReportService: FeeExtraReportService,
  ) {}

  @Post('generate')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  generate(@Body() dto: GenerateInvoicesDto, @CurrentUser() user: ScopedUser) {
    return this.service.generateForClass(dto, user);
  }

  // STUDENT is included so a student (or a parent using the student's login)
  // can see their own fee history in the mobile app; the service enforces
  // that a STUDENT can only ever pass their own studentId.
  @Get('student/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL', 'STUDENT')
  findForStudent(@Param('studentId') studentId: string, @CurrentUser() user: ScopedUser) {
    return this.service.findForStudent(studentId, user);
  }

  @Get('student/:studentId/ledger.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async studentLedger(@Param('studentId') studentId: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const data = await this.service.findLedgerForStudent(studentId, user);
    const pdf = await this.ledgerReportService.buildLedgerPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ledger-${data.student.admissionNo}.pdf"`);
    res.send(pdf);
  }

  @Get('dues')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findDues(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findDues(user, { schoolId, branchId, period, status });
  }

  @Get('dues/report.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async duesReport(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    const invoices = await this.service.findDues(user, { schoolId, branchId, period, status });
    const schoolLabel = invoices.length
      ? (new Set(invoices.map((i) => i.school?.name)).size === 1 ? invoices[0].school?.name ?? 'All Schools' : 'All Schools')
      : 'All Schools';
    const pdf = await this.duesReportService.buildDuesListPdf(invoices as any, { schoolLabel, period, status });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="fee-dues-report.pdf"');
    res.send(pdf);
  }

  // Class-wise collection summary for one period - GET /finance/fee-invoices/summary.pdf?schoolId=&period=YYYY-MM
  @Get('summary.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async monthlySummary(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId: string,
    @Query('period') period: string,
  ) {
    const data = await this.service.findMonthlySummary(user, schoolId, period);
    const pdf = await this.summaryReportService.buildMonthlySummaryPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="fee-summary-${period}.pdf"`);
    res.send(pdf);
  }

  // Month-by-month collection totals for a calendar year - GET /finance/fee-invoices/annual.pdf?schoolId=&year=YYYY
  @Get('annual.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async annualReport(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId: string,
    @Query('year') year: string,
  ) {
    const data = await this.service.findAnnualSummary(user, schoolId, year);
    const pdf = await this.summaryReportService.buildAnnualReportPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="annual-fee-report-${year}.pdf"`);
    res.send(pdf);
  }

  // Class-wide student x period fee register - GET /finance/fee-invoices/register.pdf?classId=&academicYearId=
  @Get('register.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async feeRegister(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const data = await this.service.findFeeRegister(user, classId, academicYearId);
    const pdf = await this.extraReportService.buildFeeRegisterPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="fee-register-${data.className}.pdf"`);
    res.send(pdf);
  }

  // Future-period invoices already fully paid - GET /finance/fee-invoices/advance.pdf?schoolId=
  @Get('advance.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async advanceFeeSheet(@CurrentUser() user: ScopedUser, @Res() res: Response, @Query('schoolId') schoolId?: string) {
    const invoices = await this.service.findAdvancePayments(user, schoolId);
    const schoolNames = new Set(invoices.map((i) => i.school.name));
    const schoolLabel = schoolNames.size === 1 ? [...schoolNames][0] : 'All Schools';
    const pdf = await this.extraReportService.buildAdvanceFeeSheetPdf(invoices as any, schoolLabel);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="advance-fee-sheet.pdf"');
    res.send(pdf);
  }

  // Guardian/nominee contact list - GET /finance/fee-invoices/nominees.pdf?schoolId=&classId=
  @Get('nominees.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async nominees(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId?: string,
    @Query('classId') classId?: string,
  ) {
    const data = await this.service.findNominees(user, schoolId, classId);
    const pdf = await this.extraReportService.buildNomineesPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="fee-nominees.pdf"');
    res.send(pdf);
  }

  // All-time class-wise collection rate - GET /finance/fee-invoices/analysis.pdf?schoolId=
  @Get('analysis.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async feeAnalysis(@CurrentUser() user: ScopedUser, @Res() res: Response, @Query('schoolId') schoolId: string) {
    const data = await this.service.findFeeAnalysis(user, schoolId);
    const pdf = await this.extraReportService.buildFeeAnalysisPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="fee-analysis.pdf"');
    res.send(pdf);
  }

  // Combined sibling statement by guardian phone - GET /finance/fee-invoices/family.pdf?guardianPhone=
  @Get('family.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async familyStatement(@CurrentUser() user: ScopedUser, @Res() res: Response, @Query('guardianPhone') guardianPhone: string) {
    const data = await this.service.findFamilyStatement(user, guardianPhone);
    const pdf = await this.extraReportService.buildFamilyStatementPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="family-fee-statement.pdf"');
    res.send(pdf);
  }

  // Blank Jan-Dec grid for manual fee tracking - GET /finance/fee-invoices/register-blank.pdf?classId=&academicYearId=
  @Get('register-blank.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async feeRegisterBlank(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const data = await this.service.findFeeRegisterStudents(user, classId, academicYearId);
    const pdf = await this.extraReportService.buildFeeRegisterBlankPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="fee-register-blank-${data.className}.pdf"`);
    res.send(pdf);
  }

  @Get(':id/overdue-notice.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async overdueNotice(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const invoice = await this.service.findOne(id, user);
    if (invoice.status === 'PAID') {
      throw new NotFoundException('This invoice is already fully paid');
    }
    const pdf = await this.duesReportService.buildOverdueNoticePdf(invoice as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="overdue-notice-${invoice.student.admissionNo}.pdf"`);
    res.send(pdf);
  }

  @Get(':id/challan.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async challan(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const invoice = await this.service.findOne(id, user);
    const pdf = await this.ledgerReportService.buildChallanPdf(invoice as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="challan-${invoice.student.admissionNo}-${invoice.period}.pdf"`);
    res.send(pdf);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }
}
