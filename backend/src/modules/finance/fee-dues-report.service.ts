import { Injectable } from '@nestjs/common';
// See fee-receipt.service.ts for why this must be a namespace import, not a
// default import - this project's tsconfig lacks esModuleInterop.
import * as PDFDocument from 'pdfkit';

type DuesInvoice = {
  period: string;
  totalAmount: unknown;
  paidAmount: unknown;
  status: string;
  dueDate: Date;
  student: {
    admissionNo: string;
    user: { fullName: string };
    section: { name: string; class: { name: string } } | null;
  };
  school: { name: string; address: string | null } | null;
};

type OverdueInvoice = {
  period: string;
  totalAmount: unknown;
  paidAmount: unknown;
  dueDate: Date;
  items: { netAmount: unknown; feeHead: { name: string } }[];
  student: {
    admissionNo: string;
    user: { fullName: string };
    section: { name: string; class: { name: string } } | null;
  };
  school: { name: string; address: string | null; phone: string | null };
  branch: { name: string } | null;
};

@Injectable()
export class FeeDuesReportService {
  // A printable list of fee dues/invoices for a school+period+status filter
  // (mirrors the old VFP "fee_list" / "feebalance_sheet" reports). Landscape
  // A4 so the table has room to breathe.
  buildDuesListPdf(
    invoices: DuesInvoice[],
    meta: { schoolLabel: string; period?: string; status?: string },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

      doc.fontSize(15).font('Helvetica-Bold').text(meta.schoolLabel, { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('Fee Dues Report', { align: 'center' });
      const filterBits = [
        meta.period ? `Period: ${meta.period}` : 'All periods',
        meta.status ? `Status: ${meta.status}` : 'All statuses',
        `Generated: ${new Date().toLocaleDateString('en-GB')}`,
      ];
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(filterBits.join('   |   '), { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(0.75);

      const colX = { student: 36, admission: 210, cls: 310, total: 470, paid: 560, balance: 650, status: 730 };
      const tableTop = doc.y;

      function drawHeader(y: number) {
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Student', colX.student, y);
        doc.text('Admission No', colX.admission, y);
        doc.text('Class', colX.cls, y);
        doc.text('Total', colX.total, y, { width: 80, align: 'right' });
        doc.text('Paid', colX.paid, y, { width: 80, align: 'right' });
        doc.text('Balance', colX.balance, y, { width: 70, align: 'right' });
        doc.text('Status', colX.status, y);
        doc.moveTo(36, y + 15).lineTo(806, y + 15).stroke();
      }

      drawHeader(tableTop);
      let rowY = tableTop + 22;
      let totalSum = 0;
      let paidSum = 0;

      doc.font('Helvetica').fontSize(9.5);
      for (const inv of invoices) {
        if (rowY > doc.page.height - 60) {
          doc.addPage();
          rowY = 40;
          drawHeader(rowY);
          rowY += 22;
        }
        const total = Number(inv.totalAmount);
        const paid = Number(inv.paidAmount);
        const balance = Math.max(total - paid, 0);
        totalSum += total;
        paidSum += paid;

        const classLabel = inv.student.section ? `${inv.student.section.class.name} - ${inv.student.section.name}` : '—';
        doc.text(inv.student.user.fullName, colX.student, rowY, { width: 165 });
        doc.text(inv.student.admissionNo, colX.admission, rowY);
        doc.text(classLabel, colX.cls, rowY, { width: 150 });
        doc.text(money(total), colX.total, rowY, { width: 80, align: 'right' });
        doc.text(money(paid), colX.paid, rowY, { width: 80, align: 'right' });
        doc.text(money(balance), colX.balance, rowY, { width: 70, align: 'right' });
        doc.text(inv.status, colX.status, rowY);
        rowY += 18;
      }

      doc.moveTo(36, rowY + 2).lineTo(806, rowY + 2).stroke();
      rowY += 10;
      doc.font('Helvetica-Bold');
      doc.text(`${invoices.length} invoice(s)`, colX.student, rowY);
      doc.text(money(totalSum), colX.total, rowY, { width: 80, align: 'right' });
      doc.text(money(paidSum), colX.paid, rowY, { width: 80, align: 'right' });
      doc.text(money(Math.max(totalSum - paidSum, 0)), colX.balance, rowY, { width: 70, align: 'right' });

      doc.end();
    });
  }

  // A formal notice letter for one overdue/partially-paid invoice, addressed
  // to the parent/guardian (mirrors the old VFP "over_dues_notice" report).
  buildOverdueNoticePdf(invoice: OverdueInvoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A5', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
      const balance = Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0);

      doc.fontSize(15).font('Helvetica-Bold').text(invoice.school.name, { align: 'center' });
      if (invoice.branch) doc.fontSize(10).font('Helvetica').text(invoice.branch.name, { align: 'center' });
      if (invoice.school.address) doc.fontSize(9).fillColor('#555').text(invoice.school.address, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(0.5);
      doc.fontSize(13).font('Helvetica-Bold').text('FEE OVERDUE NOTICE', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`);
      doc.moveDown(0.5);
      doc.text('Dear Parent/Guardian,');
      doc.moveDown(0.5);

      const classLabel = invoice.student.section
        ? `${invoice.student.section.class.name} - ${invoice.student.section.name}`
        : '—';
      doc.text(
        `This is to inform you that the fee for your child, ${invoice.student.user.fullName} ` +
          `(Admission No: ${invoice.student.admissionNo}, Class: ${classLabel}), for the period ` +
          `${invoice.period} remains unpaid as of today. The details are below:`,
        { align: 'left' },
      );
      doc.moveDown(0.75);

      const top = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Fee Head', 40, top);
      doc.text('Amount', 300, top, { width: 130, align: 'right' });
      doc.moveTo(40, top + 14).lineTo(430, top + 14).stroke();
      let rowY = top + 20;
      doc.font('Helvetica').fontSize(10);
      for (const item of invoice.items) {
        doc.text(item.feeHead.name, 40, rowY);
        doc.text(money(item.netAmount), 300, rowY, { width: 130, align: 'right' });
        rowY += 16;
      }
      doc.moveTo(40, rowY + 2).lineTo(430, rowY + 2).stroke();
      rowY += 10;
      doc.font('Helvetica-Bold');
      doc.text('Due Date:', 40, rowY);
      doc.text(new Date(invoice.dueDate).toLocaleDateString('en-GB'), 300, rowY, { width: 130, align: 'right' });
      rowY += 16;
      doc.text('Amount Due:', 40, rowY);
      doc.text(money(balance), 300, rowY, { width: 130, align: 'right' });
      doc.moveDown(2.5);

      doc.font('Helvetica').fontSize(10);
      doc.text(
        'Kindly clear the outstanding amount at your earliest convenience to avoid any inconvenience. ' +
          'If you have already made this payment, please disregard this notice and share the receipt with the school office.',
      );
      doc.moveDown(1.5);
      doc.text('Thank you,');
      doc.text('School Administration');

      doc.fontSize(8).fillColor('#777');
      doc.text('This is a computer-generated notice.', 40, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width - 80,
      });

      doc.end();
    });
  }
}
