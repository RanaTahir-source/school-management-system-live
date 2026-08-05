import { Injectable } from '@nestjs/common';
// See fee-receipt.service.ts for why this must be a namespace import, not a
// default import - this project's tsconfig lacks esModuleInterop.
import * as PDFDocument from 'pdfkit';

type CollectionPayment = {
  receiptNo: string;
  amount: unknown;
  method: string | null;
  invoice: {
    period: string;
    student: {
      admissionNo: string;
      user: { fullName: string };
      section: { name: string; class: { name: string } } | null;
    };
  };
  receivedBy: { fullName: string };
};

type CollectionReportData = { date: string; schoolLabel: string; payments: CollectionPayment[] };

type MonthlySummaryRow = { className: string; studentCount: number; totalAmount: number; paidAmount: number; balance: number };
type MonthlySummaryData = {
  schoolName: string;
  period: string;
  rows: MonthlySummaryRow[];
  grandTotal: { studentCount: number; totalAmount: number; paidAmount: number; balance: number };
};

type AnnualRow = { period: string; totalAmount: number; paidAmount: number; balance: number };
type AnnualReportData = {
  schoolName: string;
  year: string;
  rows: AnnualRow[];
  grandTotal: { totalAmount: number; paidAmount: number; balance: number };
};

@Injectable()
export class FeeSummaryReportService {
  // All fee payments received on one calendar day (mirrors the old VFP
  // "feetoday" / "fee_receiving_sheet" reports) - the accountant's daily
  // cash book for fee collection.
  buildCollectionReportPdf(data: CollectionReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) =>
        `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolLabel, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Daily Fee Collection Report', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `Date: ${data.date}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
        { align: 'center' },
      );
      doc.fillColor('#000');
      doc.moveDown(0.75);

      const colX = { receipt: 36, student: 150, admission: 340, cls: 430, period: 540, amount: 610, method: 700, by: 770 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Receipt No', colX.receipt, y);
        doc.text('Student', colX.student, y);
        doc.text('Admission No', colX.admission, y);
        doc.text('Class', colX.cls, y);
        doc.text('Period', colX.period, y);
        doc.text('Amount', colX.amount, y, { width: 80, align: 'right' });
        doc.text('Method', colX.method, y);
        doc.text('Received By', colX.by, y);
        doc.moveTo(36, y + 15).lineTo(806, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;
      let sum = 0;

      doc.font('Helvetica').fontSize(9);
      for (const p of data.payments) {
        if (rowY > doc.page.height - 60) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const amt = Number(p.amount);
        sum += amt;
        const classLabel = p.invoice.student.section
          ? `${p.invoice.student.section.class.name} - ${p.invoice.student.section.name}`
          : '—';
        doc.text(p.receiptNo, colX.receipt, rowY, { width: 110 });
        doc.text(p.invoice.student.user.fullName, colX.student, rowY, { width: 185 });
        doc.text(p.invoice.student.admissionNo, colX.admission, rowY, { width: 85 });
        doc.text(classLabel, colX.cls, rowY, { width: 105 });
        doc.text(p.invoice.period, colX.period, rowY, { width: 65 });
        doc.text(money(amt), colX.amount, rowY, { width: 80, align: 'right' });
        doc.text(p.method ?? 'Cash', colX.method, rowY, { width: 65 });
        doc.text(p.receivedBy.fullName, colX.by, rowY, { width: 100 });
        rowY += 18;
      }

      if (data.payments.length === 0) {
        doc.fillColor('#777').text('No fee payments recorded for this date.', colX.receipt, rowY);
        doc.fillColor('#000');
      } else {
        doc.moveTo(36, rowY + 2).lineTo(806, rowY + 2).stroke();
        rowY += 10;
        doc.font('Helvetica-Bold');
        doc.text(`${data.payments.length} payment(s)`, colX.receipt, rowY);
        doc.text(money(sum), colX.amount, rowY, { width: 80, align: 'right' });
      }

      doc.end();
    });
  }

  // Class-wise collection summary for one period (mirrors the old VFP
  // "monthly_fee_detail" report).
  buildMonthlySummaryPdf(data: MonthlySummaryData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: number) => `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Monthly Fee Collection Summary', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `Period: ${data.period}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
        { align: 'center' },
      );
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { cls: 40, students: 220, total: 300, paid: 400, balance: 490 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Class', colX.cls, y);
        doc.text('Students', colX.students, y, { width: 70, align: 'right' });
        doc.text('Invoiced', colX.total, y, { width: 90, align: 'right' });
        doc.text('Collected', colX.paid, y, { width: 80, align: 'right' });
        doc.text('Balance', colX.balance, y, { width: 80, align: 'right' });
        doc.moveTo(40, y + 16).lineTo(555, y + 16).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 24;

      doc.font('Helvetica').fontSize(10);
      for (const r of data.rows) {
        if (rowY > doc.page.height - 70) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 24;
        }
        doc.text(r.className, colX.cls, rowY, { width: 170 });
        doc.text(String(r.studentCount), colX.students, rowY, { width: 70, align: 'right' });
        doc.text(money(r.totalAmount), colX.total, rowY, { width: 90, align: 'right' });
        doc.text(money(r.paidAmount), colX.paid, rowY, { width: 80, align: 'right' });
        doc.text(money(r.balance), colX.balance, rowY, { width: 80, align: 'right' });
        rowY += 20;
      }

      if (data.rows.length === 0) {
        doc.fillColor('#777').text('No invoices found for this period.', colX.cls, rowY);
        doc.fillColor('#000');
      } else {
        doc.moveTo(40, rowY + 2).lineTo(555, rowY + 2).stroke();
        rowY += 12;
        doc.font('Helvetica-Bold');
        doc.text('Grand Total', colX.cls, rowY);
        doc.text(String(data.grandTotal.studentCount), colX.students, rowY, { width: 70, align: 'right' });
        doc.text(money(data.grandTotal.totalAmount), colX.total, rowY, { width: 90, align: 'right' });
        doc.text(money(data.grandTotal.paidAmount), colX.paid, rowY, { width: 80, align: 'right' });
        doc.text(money(data.grandTotal.balance), colX.balance, rowY, { width: 80, align: 'right' });
      }

      doc.end();
    });
  }

  // Month-by-month collection totals for a full calendar year (mirrors the
  // old VFP "annual_fee_report").
  buildAnnualReportPdf(data: AnnualReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: number) => `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Annual Fee Report', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `Year: ${data.year}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
        { align: 'center' },
      );
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { period: 40, total: 220, paid: 340, balance: 450 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Month', colX.period, y);
        doc.text('Invoiced', colX.total, y, { width: 100, align: 'right' });
        doc.text('Collected', colX.paid, y, { width: 90, align: 'right' });
        doc.text('Balance', colX.balance, y, { width: 90, align: 'right' });
        doc.moveTo(40, y + 16).lineTo(555, y + 16).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 24;

      doc.font('Helvetica').fontSize(10);
      for (const r of data.rows) {
        doc.text(r.period, colX.period, rowY, { width: 170 });
        doc.text(money(r.totalAmount), colX.total, rowY, { width: 100, align: 'right' });
        doc.text(money(r.paidAmount), colX.paid, rowY, { width: 90, align: 'right' });
        doc.text(money(r.balance), colX.balance, rowY, { width: 90, align: 'right' });
        rowY += 20;
      }

      doc.moveTo(40, rowY + 2).lineTo(555, rowY + 2).stroke();
      rowY += 12;
      doc.font('Helvetica-Bold');
      doc.text('Grand Total', colX.period, rowY);
      doc.text(money(data.grandTotal.totalAmount), colX.total, rowY, { width: 100, align: 'right' });
      doc.text(money(data.grandTotal.paidAmount), colX.paid, rowY, { width: 90, align: 'right' });
      doc.text(money(data.grandTotal.balance), colX.balance, rowY, { width: 90, align: 'right' });

      doc.end();
    });
  }
}
