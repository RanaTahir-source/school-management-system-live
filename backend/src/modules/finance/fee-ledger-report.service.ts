import { Injectable } from '@nestjs/common';
// See fee-receipt.service.ts for why this must be a namespace import, not a
// default import - this project's tsconfig lacks esModuleInterop.
import * as PDFDocument from 'pdfkit';

type LedgerInvoice = {
  period: string;
  totalAmount: unknown;
  paidAmount: unknown;
  status: string;
  dueDate: Date;
  payments: { receiptNo: string; amount: unknown; paidDate: Date; method: string | null }[];
};

type LedgerData = {
  student: {
    admissionNo: string;
    user: { fullName: string };
    section: { name: string; class: { name: string } } | null;
  };
  school: { name: string; address: string | null } | null;
  invoices: LedgerInvoice[];
};

type ChallanInvoice = {
  period: string;
  totalAmount: unknown;
  paidAmount: unknown;
  dueDate: Date;
  student: {
    admissionNo: string;
    user: { fullName: string };
    section: { name: string; class: { name: string } } | null;
  };
  school: { name: string; address: string | null };
  branch: { name: string } | null;
};

@Injectable()
export class FeeLedgerReportService {
  // A full running statement of a student's fee history (mirrors the old
  // VFP "ledger" / "family_ledger" reports): every invoice period with its
  // charge and every payment against it, plus a running balance.
  buildLedgerPdf(data: LedgerData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(data.school?.name ?? 'School', { align: 'center' });
      if (data.school?.address) doc.fontSize(9).font('Helvetica').fillColor('#555').text(data.school.address, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(0.5);
      doc.fontSize(13).font('Helvetica-Bold').text('Student Fee Ledger', { align: 'center' });
      doc.moveDown(0.75);

      const classLabel = data.student.section ? `${data.student.section.class.name} - ${data.student.section.name}` : '—';
      doc.fontSize(10).font('Helvetica');
      const top = doc.y;
      doc.text(`Student: ${data.student.user.fullName}`, 40, top);
      doc.text(`Admission No: ${data.student.admissionNo}`, 320, top);
      doc.text(`Class: ${classLabel}`, 40, top + 16);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 320, top + 16);
      doc.moveDown(2.5);

      const colX = { period: 40, charged: 160, paid: 250, balance: 340, running: 430 };
      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Period', colX.period, y);
        doc.text('Charged', colX.charged, y, { width: 80, align: 'right' });
        doc.text('Paid', colX.paid, y, { width: 80, align: 'right' });
        doc.text('Balance', colX.balance, y, { width: 80, align: 'right' });
        doc.text('Running Bal.', colX.running, y, { width: 90, align: 'right' });
        doc.moveTo(40, y + 15).lineTo(520, y + 15).stroke();
      }

      let rowY = doc.y;
      drawHeader(rowY);
      rowY += 22;
      let running = 0;

      doc.font('Helvetica').fontSize(9.5);
      for (const inv of data.invoices) {
        if (rowY > doc.page.height - 100) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const charged = Number(inv.totalAmount);
        const paid = Number(inv.paidAmount);
        const balance = Math.max(charged - paid, 0);
        running += charged - paid;

        doc.text(inv.period, colX.period, rowY);
        doc.text(money(charged), colX.charged, rowY, { width: 80, align: 'right' });
        doc.text(money(paid), colX.paid, rowY, { width: 80, align: 'right' });
        doc.text(money(balance), colX.balance, rowY, { width: 80, align: 'right' });
        doc.text(money(running), colX.running, rowY, { width: 90, align: 'right' });
        rowY += 16;

        for (const p of inv.payments) {
          doc.fillColor('#666').fontSize(8.5);
          doc.text(
            `  Receipt ${p.receiptNo} - ${money(p.amount)} on ${new Date(p.paidDate).toLocaleDateString('en-GB')} (${p.method ?? 'Cash'})`,
            colX.period,
            rowY,
          );
          doc.fillColor('#000').fontSize(9.5);
          rowY += 13;
        }
        rowY += 4;
      }

      doc.moveTo(40, rowY + 2).lineTo(520, rowY + 2).stroke();
      rowY += 10;
      doc.font('Helvetica-Bold');
      doc.text('Total Outstanding:', colX.balance - 100, rowY, { width: 180, align: 'right' });
      doc.text(money(Math.max(running, 0)), colX.running, rowY, { width: 90, align: 'right' });

      doc.end();
    });
  }

  // A fee deposit slip (mirrors the old VFP "bank_challan_1"/"bank_challan_half"
  // reports) - three stacked copies (Bank / School / Student) of the same
  // invoice summary on one A4 page, with a blank line for the bank name
  // since this project doesn't track individual bank accounts per school.
  buildChallanPdf(invoice: ChallanInvoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
      const balance = Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0);
      const classLabel = invoice.student.section
        ? `${invoice.student.section.class.name} - ${invoice.student.section.name}`
        : '—';

      const copyHeight = 250;
      const copyLabels = ['Bank Copy', 'School Copy', 'Student Copy'];

      copyLabels.forEach((label, i) => {
        const top = 30 + i * copyHeight;
        doc.rect(30, top, doc.page.width - 60, copyHeight - 15).stroke();

        doc.fontSize(12).font('Helvetica-Bold').text(invoice.school.name, 45, top + 12, { align: 'center', width: doc.page.width - 90 });
        if (invoice.branch) {
          doc.fontSize(9).font('Helvetica').text(invoice.branch.name, 45, top + 28, { align: 'center', width: doc.page.width - 90 });
        }
        doc.fontSize(10).font('Helvetica-Bold').text('FEE DEPOSIT SLIP', 45, top + 44, { align: 'center', width: doc.page.width - 90 });
        doc.fontSize(9).font('Helvetica').fillColor('#555').text(label, doc.page.width - 150, top + 12, { align: 'right', width: 105 });
        doc.fillColor('#000');

        const fieldTop = top + 68;
        doc.fontSize(9.5).font('Helvetica');
        doc.text(`Student: ${invoice.student.user.fullName}`, 45, fieldTop);
        doc.text(`Admission No: ${invoice.student.admissionNo}`, 320, fieldTop);
        doc.text(`Class: ${classLabel}`, 45, fieldTop + 16);
        doc.text(`Period: ${invoice.period}`, 320, fieldTop + 16);
        doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-GB')}`, 45, fieldTop + 32);
        doc.font('Helvetica-Bold').text(`Amount Payable: ${money(balance)}`, 320, fieldTop + 32);
        doc.font('Helvetica');

        doc.text('Bank Name: ____________________________', 45, fieldTop + 56);
        doc.text('Deposit Date: __________________', 320, fieldTop + 56);
        doc.text('Depositor Signature: ____________________________', 45, fieldTop + 78);
        doc.text('Bank Stamp:', 320, fieldTop + 78);
      });

      doc.end();
    });
  }
}
