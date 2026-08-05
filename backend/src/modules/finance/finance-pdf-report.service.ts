import { Injectable } from '@nestjs/common';
// See fee-receipt.service.ts for why this must be a namespace import, not a
// default import - this project's tsconfig lacks esModuleInterop.
import * as PDFDocument from 'pdfkit';

type ReportSide = {
  total: number;
  byCategory: { category: string; amount: number }[];
  byBranch: { branchName: string; total: number; byCategory: { category: string; amount: number }[] }[];
};

type StatementData = {
  schoolName: string;
  period: { from: string; to: string };
  income: ReportSide;
  expense: ReportSide;
  netBalance: number;
};

type ConcessionRow = {
  type: 'PERCENTAGE' | 'FLAT';
  value: unknown;
  reason: string | null;
  student: { admissionNo: string; user: { fullName: string }; section: { name: string; class: { name: string } } | null };
  feeHead: { name: string } | null;
};

type VoucherData = {
  kind: 'INCOME' | 'EXPENSE';
  schoolName: string;
  branchName: string | null;
  category: string;
  amount: unknown;
  date: Date;
  description: string | null;
  recordedByName: string;
  studentName?: string | null;
};

@Injectable()
export class FinancePdfReportService {
  // Income vs. expense statement for a date range (mirrors the old VFP
  // "profit_and_loss" / part of "balance_sheet" reports) - category and
  // branch breakdown on each side, plus net balance.
  buildStatementPdf(data: StatementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: number) => `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Income & Expense Statement', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(
        `${data.period.from} to ${data.period.to}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`,
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
        doc.font('Helvetica-Bold');
        doc.text('Subtotal', 50, doc.y, { continued: true, width: 350 });
        doc.text(money(side.total), { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown(0.5);

        if (side.byBranch.length > 1) {
          doc.fontSize(9).fillColor('#555').text('By branch:', 50);
          doc.fillColor('#000');
          for (const b of side.byBranch) {
            doc.text(`  ${b.branchName}`, 50, doc.y, { continued: true, width: 350 });
            doc.text(money(b.total), { align: 'right' });
          }
          doc.moveDown(0.5);
        }
        doc.moveDown(0.5);
      };

      drawSide('Income', data.income, '#0a7d32');
      drawSide('Expense', data.expense, '#c0392b');

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

  // All active fee concessions for a school (mirrors the old VFP
  // "concession_list" report) - who's getting a discount, how much, and why.
  buildConcessionListPdf(rows: ConcessionRow[], schoolName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(15).font('Helvetica-Bold').text(schoolName, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Fee Concession List', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      const colX = { student: 36, admission: 220, cls: 330, feeHead: 460, type: 590, value: 680, reason: 750 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Student', colX.student, y);
        doc.text('Admission No', colX.admission, y);
        doc.text('Class', colX.cls, y);
        doc.text('Fee Head', colX.feeHead, y);
        doc.text('Type', colX.type, y);
        doc.text('Value', colX.value, y, { width: 60, align: 'right' });
        doc.text('Reason', colX.reason, y);
        doc.moveTo(36, y + 15).lineTo(806, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;

      doc.font('Helvetica').fontSize(9.5);
      for (const r of rows) {
        if (rowY > doc.page.height - 60) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const classLabel = r.student.section ? `${r.student.section.class.name} - ${r.student.section.name}` : '—';
        const valueLabel = r.type === 'PERCENTAGE' ? `${r.value}%` : `Rs. ${Number(r.value).toLocaleString('en-PK')}`;
        doc.text(r.student.user.fullName, colX.student, rowY, { width: 175 });
        doc.text(r.student.admissionNo, colX.admission, rowY);
        doc.text(classLabel, colX.cls, rowY, { width: 120 });
        doc.text(r.feeHead?.name ?? 'All fee heads', colX.feeHead, rowY, { width: 120 });
        doc.text(r.type === 'PERCENTAGE' ? 'Percentage' : 'Flat', colX.type, rowY);
        doc.text(valueLabel, colX.value, rowY, { width: 60, align: 'right' });
        doc.text(r.reason ?? '—', colX.reason, rowY, { width: 56 });
        rowY += 18;
      }

      if (rows.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor('#777').text('No active concessions.', colX.student, rowY);
      }

      doc.end();
    });
  }

  // A simple in/out cash voucher for a single income or expense record
  // (mirrors the old VFP "cash_voucher" report).
  buildVoucherPdf(data: VoucherData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A5', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
      if (data.branchName) doc.fontSize(10).font('Helvetica').text(data.branchName, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(13).font('Helvetica-Bold').text(data.kind === 'INCOME' ? 'CASH RECEIPT VOUCHER' : 'CASH PAYMENT VOUCHER', {
        align: 'center',
      });
      doc.moveDown(1);

      const top = doc.y;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Date: ${new Date(data.date).toLocaleDateString('en-GB')}`, 36, top);
      doc.text(`Category: ${data.category}`, 250, top);
      if (data.studentName) {
        doc.text(`Student: ${data.studentName}`, 36, top + 18);
      }
      doc.moveDown(3);

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`Amount: ${money(data.amount)}`, 36, doc.y);
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(1);
      doc.text(`Description: ${data.description ?? '—'}`, 36, doc.y, { width: 400 });
      doc.moveDown(2);
      doc.text(`${data.kind === 'INCOME' ? 'Received' : 'Recorded'} By: ${data.recordedByName}`, 36, doc.y);

      doc.moveDown(3);
      doc.text('_______________________', 36, doc.y);
      doc.text('Signature', 36, doc.y + 12);

      doc.fontSize(8).fillColor('#777');
      doc.text('This is a computer-generated voucher.', 36, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width - 72,
      });

      doc.end();
    });
  }
}
