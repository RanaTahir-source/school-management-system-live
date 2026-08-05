import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FeePaymentService } from './fee-payment.service';
import { FeeReceiptService } from './fee-receipt.service';
import { FeeSummaryReportService } from './fee-summary-report.service';
import { RecordFeePaymentDto } from './dto/record-fee-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = { userId: string } & ScopedUser;

function today() {
  return new Date().toISOString().slice(0, 10);
}

@Controller('finance/fee-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeePaymentController {
  constructor(
    private readonly service: FeePaymentService,
    private readonly receiptService: FeeReceiptService,
    private readonly summaryReportService: FeeSummaryReportService,
  ) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  record(@Body() dto: RecordFeePaymentDto, @CurrentUser() user: Requester) {
    return this.service.record(dto, user);
  }

  // Daily fee collection report - GET /finance/fee-payments/collection-report.pdf?schoolId=&date=YYYY-MM-DD
  // Must be declared before ":id" so it isn't swallowed by that wildcard route.
  @Get('collection-report.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async collectionReport(
    @CurrentUser() user: ScopedUser,
    @Res() res: Response,
    @Query('schoolId') schoolId?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.service.findCollectionReport(user, schoolId, date || today());
    const pdf = await this.summaryReportService.buildCollectionReportPdf(data as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="fee-collection-${data.date}.pdf"`);
    res.send(pdf);
  }

  // STUDENT/PARENT included for the mobile app's own-receipt view; ownership
  // is enforced in FeePaymentService.findOne.
  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL', 'STUDENT', 'PARENT')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Get(':id/receipt.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL', 'STUDENT', 'PARENT')
  async receipt(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const payment = await this.service.findOne(id, user);
    const pdf = await this.receiptService.buildReceiptPdf(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.receiptNo}.pdf"`);
    res.send(pdf);
  }
}
