import { Injectable } from '@nestjs/common';
// See fee-receipt.service.ts for why this must be a namespace import, not a
// default import - this project's tsconfig lacks esModuleInterop.
import * as PDFDocument from 'pdfkit';

type RegisterInvoiceCell = { status: string; totalAmount: unknown; paidAmount: unknown } | null;
type RegisterRow = {
  student: { admissionNo: string; user: { fullName: string } };
  cells: RegisterInvoiceCell[];
};
type FeeRegisterData = {
  school: { name: string };
  className: string;
  periods: string[];
  rows: RegisterRow[];
};

type AdvanceInvoice = {
  period: string;
  totalAmount: unknown;
  student: {
    admissionNo: string;
    user: { fullName: string };
    section: { name: string; class: { name: string } } | null;
  };
  payments: { receiptNo: string; paidDate: Date }[];
};

type ReportSide = { total: number; byCategory: { category: string; amount: number }[] };
type BalanceSheetData = {
  schoolName: string;
  asOfDate: string;
  income: ReportSide;
  expense: ReportSide;
  netBalance: number;
};

type NomineeStudent = {
  admissionNo: string;
  user: { fullName: string };
  section: { name: string; class: { name: string } } | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianCnic: string | null;
  address: string | null;
};
type NomineesData = { schoolName: string; students: NomineeStudent[] };

type SecurityDepositRecord = {
  date: Date;
  amount: unknown;
  description: string | null;
  school: { name: string };
  branch: { name: string } | null;
  student: { user: { fullName: string } } | null;
  receivedBy: { fullName: string };
};

type FeeAnalysisRow = {
  className: string;
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  collectionRate: number;
};
type FeeAnalysisData = {
  schoolName: string;
  rows: FeeAnalysisRow[];
  grandTotal: Omit<FeeAnalysisRow, 'className'>;
};

type FamilyStudentRow = {
  student: {
    admissionNo: string;
    user: { fullName: string };
    section: { name: string; class: { name: string } } | null;
  };
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
};
type FamilyStatementData = {
  guardianPhone: string;
  guardianName: string | null;
  schoolName: string;
  byStudent: FamilyStudentRow[];
  familyTotal: { totalAmount: number; paidAmount: number; balance: number };
};

type RegisterBlankStudent = { admissionNo: string; user: { fullName: string } };
type FeeRegisterBlankData = {
  school: { name: string };
  className: string;
  students: RegisterBlankStudent[];
};

type PurchaseRecord = {
  date: Date;
  amount: unknown;
  category: string;
  description: string | null;
  school: { name: string };
  branch: { name: string } | null;
  recordedBy: { fullName: string };
};

@Injectable()
export class FeeExtraReportService {
  // Class-wide student x period grid (mirrors the old VFP
  // "fee_register_filled" report) - landscape, one row per student, one
  // column per period, "Paid"/"Partial"/"Unpaid" per cell, blank if no
  // invoice was ever generated for that student+period.
  buildFeeRegisterPdf(data: FeeRegisterData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(15).font('Helvetica-Bold').text(data.school.name, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text(`Fee Register — ${data.className}`, { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(0.75);

      const nameColWidth = 180;
      const admColWidth = 90;
      const pageRight = doc.page.width - 30;
      const usableWidth = pageRight - 30 - nameColWidth - admColWidth;
      const periods = data.periods.length > 0 ? data.periods : [];
      const colWidth = periods.length > 0 ? Math.max(usableWidth / periods.length, 45) : 0;

      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(8.5);
        doc.text('Student', 30, y, { width: nameColWidth });
        doc.text('Admission No', 30 + nameColWidth, y, { width: admColWidth });
        let x = 30 + nameColWidth + admColWidth;
        for (const p of periods) {
          doc.text(p, x, y, { width: colWidth, align: 'center' });
          x += colWidth;
        }
        doc.moveTo(30, y + 14).lineTo(pageRight, y + 14).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 20;

      doc.font('Helvetica').fontSize(8);
      for (const row of data.rows) {
        if (rowY > doc.page.height - 50) {
          doc.addPage();
          rowY = 30;
          drawHeader(rowY);
          rowY += 20;
        }
        doc.text(row.student.user.fullName, 30, rowY, { width: nameColWidth });
        doc.text(row.student.admissionNo, 30 + nameColWidth, rowY, { width: admColWidth });
        let x = 30 + nameColWidth + admColWidth;
        for (const cell of row.cells) {
          let label = '—';
          if (cell) {
            const total = Number(cell.totalAmount);
            const paid = Number(cell.paidAmount);
            label = cell.status === 'PAID' ? 'Paid' : cell.status === 'PARTIAL' ? `${paid}/${total}` : 'Unpaid';
          }
          doc.text(label, x, rowY, { width: colWidth, align: 'center' });
          x += colWidth;
        }
        rowY += 16;
      }

      if (data.rows.length === 0) {
        doc.fillColor('#777').text('No active students found in this class.', 30, rowY);
        doc.fillColor('#000');
      } else if (periods.length === 0) {
        doc.fillColor('#777').text('No invoices have been generated for this class yet.', 30, rowY);
        doc.fillColor('#000');
      }

      doc.end();
    });
  }

  // Invoices for future periods already fully paid (mirrors the old VFP
  // "advance_fee_sheet" report).
  buildAdvanceFeeSheetPdf(invoices: AdvanceInvoice[], schoolLabel: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(schoolLabel, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Advance Fee Sheet', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `Invoices paid ahead of their due period   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
        { align: 'center' },
      );
      doc.fillColor('#000');
      doc.moveDown(0.75);

      const colX = { student: 36, admission: 220, cls: 330, period: 460, amount: 560, receipt: 660, date: 760 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Student', colX.student, y);
        doc.text('Admission No', colX.admission, y);
        doc.text('Class', colX.cls, y);
        doc.text('Period', colX.period, y);
        doc.text('Amount', colX.amount, y, { width: 80, align: 'right' });
        doc.text('Receipt No', colX.receipt, y);
        doc.text('Paid Date', colX.date, y);
        doc.moveTo(36, y + 15).lineTo(806, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;

      doc.font('Helvetica').fontSize(9.5);
      for (const inv of invoices) {
        if (rowY > doc.page.height - 60) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const classLabel = inv.student.section ? `${inv.student.section.class.name} - ${inv.student.section.name}` : '—';
        const lastPayment = inv.payments[0];
        doc.text(inv.student.user.fullName, colX.student, rowY, { width: 175 });
        doc.text(inv.student.admissionNo, colX.admission, rowY);
        doc.text(classLabel, colX.cls, rowY, { width: 120 });
        doc.text(inv.period, colX.period, rowY);
        doc.text(money(inv.totalAmount), colX.amount, rowY, { width: 80, align: 'right' });
        doc.text(lastPayment?.receiptNo ?? '—', colX.receipt, rowY);
        doc.text(lastPayment ? new Date(lastPayment.paidDate).toLocaleDateString('en-GB') : '—', colX.date, rowY);
        rowY += 18;
      }

      if (invoices.length === 0) {
        doc.fillColor('#777').text('No advance (future-period) payments found.', colX.student, rowY);
        doc.fillColor('#000');
      }

      doc.end();
    });
  }

  // Cumulative income vs. expense as of one date (mirrors the old VFP
  // "balance_sheet"/"balance_sheet_date" reports).
  buildBalanceSheetPdf(data: BalanceSheetData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: number) => `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Balance Sheet', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `As of ${data.asOfDate}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
        { align: 'center' },
      );
      doc.fillColor('#000');
      doc.moveDown(1);

      const drawSide = (title: string, side: ReportSide, color: string) => {
        doc.fontSize(11).font('Helvetica-Bold').fillColor(color).text(title);
        doc.fillColor('#000');
        doc.moveDown(0.25);
        doc.fontSize(9.5).font('Helvetica');
        for (const c of side.byCategory) {
          doc.text(c.category, 50, doc.y, { continued: true, width: 350 });
          doc.text(money(c.amount), { align: 'right' });
        }
        if (side.byCategory.length === 0) {
          doc.fillColor('#777').text('None recorded.', 50, doc.y);
          doc.fillColor('#000');
        }
        doc.font('Helvetica-Bold');
        doc.text('Subtotal', 50, doc.y, { continued: true, width: 350 });
        doc.text(money(side.total), { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown(0.5);
      };

      drawSide('Total Income (since inception)', data.income, '#0a7d32');
      drawSide('Total Expense (since inception)', data.expense, '#c0392b');

      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Net Balance', 50, doc.y, { continued: true, width: 350 });
      doc.fillColor(data.netBalance >= 0 ? '#0a7d32' : '#c0392b');
      doc.text(money(data.netBalance), { align: 'right' });
      doc.fillColor('#000');

      doc.end();
    });
  }

  // Guardian/nominee contact list per student (mirrors the old VFP
  // "fee_nominees" report) - who to contact for each student's fee matters.
  buildNomineesPdf(data: NomineesData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Fee Nominees / Guardian Contact List', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(0.75);

      const colX = { student: 36, admission: 190, cls: 280, guardian: 370, phone: 520, cnic: 620, address: 720 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Student', colX.student, y);
        doc.text('Admission No', colX.admission, y);
        doc.text('Class', colX.cls, y);
        doc.text('Guardian', colX.guardian, y);
        doc.text('Phone', colX.phone, y);
        doc.text('CNIC', colX.cnic, y);
        doc.text('Address', colX.address, y);
        doc.moveTo(36, y + 14).lineTo(806, y + 14).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 20;

      doc.font('Helvetica').fontSize(8.5);
      for (const s of data.students) {
        if (rowY > doc.page.height - 55) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 20;
        }
        const classLabel = s.section ? `${s.section.class.name} - ${s.section.name}` : '—';
        doc.text(s.user.fullName, colX.student, rowY, { width: 150 });
        doc.text(s.admissionNo, colX.admission, rowY, { width: 85 });
        doc.text(classLabel, colX.cls, rowY, { width: 85 });
        doc.text(s.guardianName ?? '—', colX.guardian, rowY, { width: 145 });
        doc.text(s.guardianPhone ?? '—', colX.phone, rowY, { width: 95 });
        doc.text(s.guardianCnic ?? '—', colX.cnic, rowY, { width: 95 });
        doc.text(s.address ?? '—', colX.address, rowY, { width: 80 });
        rowY += 17;
      }

      if (data.students.length === 0) {
        doc.fillColor('#777').text('No active students found.', colX.student, rowY);
        doc.fillColor('#000');
      }

      doc.end();
    });
  }

  // Income records tagged as security deposits (mirrors the old VFP
  // "security" report).
  buildSecurityDepositPdf(records: SecurityDepositRecord[], schoolLabel: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(schoolLabel, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Security Deposit Report', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { date: 40, student: 120, branch: 290, amount: 400, by: 480 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Date', colX.date, y);
        doc.text('Student', colX.student, y);
        doc.text('Branch', colX.branch, y);
        doc.text('Amount', colX.amount, y, { width: 70, align: 'right' });
        doc.text('Received By', colX.by, y);
        doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;
      let sum = 0;

      doc.font('Helvetica').fontSize(9.5);
      for (const r of records) {
        if (rowY > doc.page.height - 60) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const amt = Number(r.amount);
        sum += amt;
        doc.text(new Date(r.date).toLocaleDateString('en-GB'), colX.date, rowY);
        doc.text(r.student?.user.fullName ?? '—', colX.student, rowY, { width: 160 });
        doc.text(r.branch?.name ?? '—', colX.branch, rowY, { width: 100 });
        doc.text(money(amt), colX.amount, rowY, { width: 70, align: 'right' });
        doc.text(r.receivedBy.fullName, colX.by, rowY, { width: 75 });
        rowY += 18;
      }

      if (records.length === 0) {
        doc.fillColor('#777').text('No security deposit records found.', colX.date, rowY);
        doc.fillColor('#000');
      } else {
        doc.moveTo(40, rowY + 2).lineTo(555, rowY + 2).stroke();
        rowY += 10;
        doc.font('Helvetica-Bold');
        doc.text(`${records.length} record(s)`, colX.date, rowY);
        doc.text(money(sum), colX.amount, rowY, { width: 70, align: 'right' });
      }

      doc.end();
    });
  }

  // All-time class-wise collection rate (mirrors the old VFP
  // "fee_analysing" report).
  buildFeeAnalysisPdf(data: FeeAnalysisData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: number) => `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Fee Analysis (All-Time, by Class)', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { cls: 40, count: 190, total: 250, paid: 340, balance: 420, rate: 500 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Class', colX.cls, y);
        doc.text('Invoices', colX.count, y, { width: 55, align: 'right' });
        doc.text('Invoiced', colX.total, y, { width: 85, align: 'right' });
        doc.text('Collected', colX.paid, y, { width: 75, align: 'right' });
        doc.text('Balance', colX.balance, y, { width: 75, align: 'right' });
        doc.text('Rate', colX.rate, y, { width: 55, align: 'right' });
        doc.moveTo(40, y + 16).lineTo(555, y + 16).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 24;

      doc.font('Helvetica').fontSize(9.5);
      for (const r of data.rows) {
        if (rowY > doc.page.height - 70) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 24;
        }
        doc.text(r.className, colX.cls, rowY, { width: 145 });
        doc.text(String(r.invoiceCount), colX.count, rowY, { width: 55, align: 'right' });
        doc.text(money(r.totalAmount), colX.total, rowY, { width: 85, align: 'right' });
        doc.text(money(r.paidAmount), colX.paid, rowY, { width: 75, align: 'right' });
        doc.text(money(r.balance), colX.balance, rowY, { width: 75, align: 'right' });
        doc.text(`${r.collectionRate}%`, colX.rate, rowY, { width: 55, align: 'right' });
        rowY += 20;
      }

      if (data.rows.length === 0) {
        doc.fillColor('#777').text('No invoices found for this school.', colX.cls, rowY);
        doc.fillColor('#000');
      } else {
        doc.moveTo(40, rowY + 2).lineTo(555, rowY + 2).stroke();
        rowY += 12;
        doc.font('Helvetica-Bold');
        doc.text('Grand Total', colX.cls, rowY);
        doc.text(String(data.grandTotal.invoiceCount), colX.count, rowY, { width: 55, align: 'right' });
        doc.text(money(data.grandTotal.totalAmount), colX.total, rowY, { width: 85, align: 'right' });
        doc.text(money(data.grandTotal.paidAmount), colX.paid, rowY, { width: 75, align: 'right' });
        doc.text(money(data.grandTotal.balance), colX.balance, rowY, { width: 75, align: 'right' });
        doc.text(`${data.grandTotal.collectionRate}%`, colX.rate, rowY, { width: 55, align: 'right' });
      }

      doc.end();
    });
  }

  // Combined statement for all active siblings under one guardian phone
  // (mirrors the old VFP "family_fee"/"family_fee_balance"/"family_ledger"
  // reports).
  buildFamilyStatementPdf(data: FamilyStatementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: number) => `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Family Fee Statement', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `Guardian: ${data.guardianName ?? '—'}   |   Phone: ${data.guardianPhone}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
        { align: 'center' },
      );
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { student: 40, admission: 220, cls: 310, count: 400, total: 440, paid: 495, balance: 550 };
      // narrower columns since page is portrait; keep within ~515pt usable width
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Student', 40, y, { width: 130 });
        doc.text('Class', 175, y, { width: 70 });
        doc.text('Invoices', 250, y, { width: 45, align: 'right' });
        doc.text('Invoiced', 300, y, { width: 75, align: 'right' });
        doc.text('Paid', 380, y, { width: 65, align: 'right' });
        doc.text('Balance', 450, y, { width: 65, align: 'right' });
        doc.moveTo(40, y + 15).lineTo(515, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 20;

      doc.font('Helvetica').fontSize(9);
      for (const r of data.byStudent) {
        const classLabel = r.student.section ? `${r.student.section.class.name} - ${r.student.section.name}` : '—';
        doc.text(r.student.user.fullName, 40, rowY, { width: 130 });
        doc.text(classLabel, 175, rowY, { width: 70 });
        doc.text(String(r.invoiceCount), 250, rowY, { width: 45, align: 'right' });
        doc.text(money(r.totalAmount), 300, rowY, { width: 75, align: 'right' });
        doc.text(money(r.paidAmount), 380, rowY, { width: 65, align: 'right' });
        doc.text(money(r.balance), 450, rowY, { width: 65, align: 'right' });
        rowY += 18;
      }

      doc.moveTo(40, rowY + 2).lineTo(515, rowY + 2).stroke();
      rowY += 12;
      doc.font('Helvetica-Bold');
      doc.text('Family Total', 40, rowY);
      doc.text(money(data.familyTotal.totalAmount), 300, rowY, { width: 75, align: 'right' });
      doc.text(money(data.familyTotal.paidAmount), 380, rowY, { width: 65, align: 'right' });
      doc.text(money(data.familyTotal.balance), 450, rowY, { width: 65, align: 'right' });

      doc.end();
    });
  }

  // Printable blank grid for manual fee tracking - fixed Jan-Dec columns,
  // no data filled in (mirrors the old VFP "fee_register_blank"/
  // "fee_register_blank_1" reports, used before/alongside computerized
  // records).
  buildFeeRegisterBlankPdf(data: FeeRegisterBlankData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(15).font('Helvetica-Bold').text(data.school.name, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text(`Fee Register (Blank) — ${data.className}`, { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text('For manual entry — Jan through Dec', { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(0.75);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const nameColWidth = 170;
      const admColWidth = 80;
      const pageRight = doc.page.width - 30;
      const usableWidth = pageRight - 30 - nameColWidth - admColWidth;
      const colWidth = usableWidth / months.length;

      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(8.5);
        doc.text('Student', 30, y, { width: nameColWidth });
        doc.text('Admission No', 30 + nameColWidth, y, { width: admColWidth });
        let x = 30 + nameColWidth + admColWidth;
        for (const m of months) {
          doc.text(m, x, y, { width: colWidth, align: 'center' });
          x += colWidth;
        }
        doc.moveTo(30, y + 14).lineTo(pageRight, y + 14).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;

      doc.font('Helvetica').fontSize(8.5);
      for (const s of data.students) {
        if (rowY > doc.page.height - 40) {
          doc.addPage();
          rowY = 30;
          drawHeader(rowY);
          rowY += 22;
        }
        doc.text(s.user.fullName, 30, rowY, { width: nameColWidth });
        doc.text(s.admissionNo, 30 + nameColWidth, rowY, { width: admColWidth });
        let x = 30 + nameColWidth + admColWidth;
        for (let i = 0; i < months.length; i++) {
          doc.rect(x + colWidth / 2 - 4, rowY - 1, 8, 8).stroke();
          x += colWidth;
        }
        rowY += 22;
      }

      if (data.students.length === 0) {
        doc.fillColor('#777').text('No active students found in this class.', 30, rowY);
        doc.fillColor('#000');
      }

      doc.end();
    });
  }

  // Expense records tagged as purchases (mirrors the old VFP "purchase"
  // report).
  buildPurchasePdf(records: PurchaseRecord[], schoolLabel: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(schoolLabel, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Purchase Report', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { date: 40, desc: 120, branch: 320, amount: 420, by: 490 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Date', colX.date, y);
        doc.text('Description', colX.desc, y);
        doc.text('Branch', colX.branch, y);
        doc.text('Amount', colX.amount, y, { width: 65, align: 'right' });
        doc.text('Recorded By', colX.by, y);
        doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;
      let sum = 0;

      doc.font('Helvetica').fontSize(9.5);
      for (const r of records) {
        if (rowY > doc.page.height - 60) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const amt = Number(r.amount);
        sum += amt;
        doc.text(new Date(r.date).toLocaleDateString('en-GB'), colX.date, rowY);
        doc.text(r.description ?? r.category, colX.desc, rowY, { width: 190 });
        doc.text(r.branch?.name ?? '—', colX.branch, rowY, { width: 90 });
        doc.text(money(amt), colX.amount, rowY, { width: 65, align: 'right' });
        doc.text(r.recordedBy.fullName, colX.by, rowY, { width: 65 });
        rowY += 18;
      }

      if (records.length === 0) {
        doc.fillColor('#777').text('No purchase records found.', colX.date, rowY);
        doc.fillColor('#000');
      } else {
        doc.moveTo(40, rowY + 2).lineTo(555, rowY + 2).stroke();
        rowY += 10;
        doc.font('Helvetica-Bold');
        doc.text(`${records.length} record(s)`, colX.date, rowY);
        doc.text(money(sum), colX.amount, rowY, { width: 65, align: 'right' });
      }

      doc.end();
    });
  }
}
