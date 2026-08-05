import { Module } from '@nestjs/common';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { FinanceReportService } from './finance-report.service';
import { FinanceReportController } from './finance-report.controller';
import { FeeHeadService } from './fee-head.service';
import { FeeHeadController } from './fee-head.controller';
import { FeeStructureService } from './fee-structure.service';
import { FeeStructureController } from './fee-structure.controller';
import { FeeConcessionService } from './fee-concession.service';
import { FeeConcessionController } from './fee-concession.controller';
import { FeeInvoiceService } from './fee-invoice.service';
import { FeeInvoiceController } from './fee-invoice.controller';
import { FeePaymentService } from './fee-payment.service';
import { FeePaymentController } from './fee-payment.controller';
import { FeeReceiptService } from './fee-receipt.service';
import { FeeDuesReportService } from './fee-dues-report.service';
import { FeeLedgerReportService } from './fee-ledger-report.service';
import { FinancePdfReportService } from './finance-pdf-report.service';
import { FeeSummaryReportService } from './fee-summary-report.service';
import { FeeExtraReportService } from './fee-extra-report.service';

@Module({
  controllers: [
    IncomeController,
    ExpenseController,
    FinanceReportController,
    FeeHeadController,
    FeeStructureController,
    FeeConcessionController,
    FeeInvoiceController,
    FeePaymentController,
  ],
  providers: [
    IncomeService,
    ExpenseService,
    FinanceReportService,
    FeeHeadService,
    FeeStructureService,
    FeeConcessionService,
    FeeInvoiceService,
    FeePaymentService,
    FeeReceiptService,
    FeeDuesReportService,
    FeeLedgerReportService,
    FinancePdfReportService,
    FeeSummaryReportService,
    FeeExtraReportService,
  ],
})
export class FinanceModule {}
