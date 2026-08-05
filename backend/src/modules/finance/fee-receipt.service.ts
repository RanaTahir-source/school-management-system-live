import { Injectable, Logger } from '@nestjs/common';
// pdfkit ships a plain CommonJS export (`module.exports = PDFDocument`), and this
// project's tsconfig doesn't set esModuleInterop, so a default import compiles to
// `require('pdfkit').default` (undefined) and crashes with "is not a constructor".
// A namespace import compiles to a plain `require('pdfkit')` instead, which works.
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

// Brand palette — deep Islamic green + gold accent, matching Dar-e-Arqam branding.
const BRAND_GREEN = '#0B5D3B';
const BRAND_GREEN_DARK = '#083E28';
const BRAND_GOLD = '#C9A227';
const ROW_ALT = '#F2F7F4';
const TEXT_MUTED = '#5B6B63';

// A fee payment loaded with its invoice/student/school relations, as returned
// by FeePaymentService.findOne().
type PaymentWithRelations = {
  id: string;
  receiptNo: string;
  amount: unknown;
  paidDate: Date;
  method: string | null;
  invoice: {
    period: string;
    totalAmount: unknown;
    paidAmount: unknown;
    items: { amount: unknown; netAmount: unknown; feeHead: { name: string } }[];
    student: {
      admissionNo: string;
      user: { fullName: string };
      section: { name: string; class: { name: string } } | null;
      photoUrl?: string | null;
    };
    school: {
      name: string;
      address: string | null;
      settings?: {
        bankName: string | null;
        bankAccountTitle: string | null;
        bankAccountNumber: string | null;
        jazzCashNumber: string | null;
        easyPaisaNumber: string | null;
        paymentQrData: string | null;
      } | null;
    };
    branch: { name: string } | null;
  };
  receivedBy: { fullName: string };
};

@Injectable()
export class FeeReceiptService {
  private readonly logger = new Logger(FeeReceiptService.name);

  // Best-effort fetch of the student's photo as a Buffer. Returns null (never
  // throws) so a broken/missing photoUrl just falls back to the placeholder —
  // a receipt should never fail to print because of a photo.
  private async fetchPhoto(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      this.logger.warn(`Could not fetch student photo (${url}): ${(err as Error).message}`);
      return null;
    }
  }

  // Draws a rounded placeholder avatar (a simple person silhouette) when no
  // photo is available, so the layout never looks broken.
  private drawPlaceholderAvatar(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
    doc.save();
    doc.roundedRect(x, y, size, size, 6).fillAndStroke('#EAF1EC', BRAND_GREEN);
    const cx = x + size / 2;
    // head
    doc.circle(cx, y + size * 0.38, size * 0.16).fill(BRAND_GREEN);
    // shoulders
    doc
      .moveTo(x + size * 0.18, y + size * 0.88)
      .quadraticCurveTo(cx, y + size * 0.55, x + size * 0.82, y + size * 0.88)
      .lineTo(x + size * 0.82, y + size)
      .lineTo(x + size * 0.18, y + size)
      .fill(BRAND_GREEN);
    doc.restore();
  }

  // Builds the human-readable text encoded in the receipt's payment QR code
  // from whichever fee-collection channels the school has configured in
  // Settings. Returns null when nothing is configured, so the receipt just
  // omits the QR block instead of printing an empty/broken one.
  private buildPaymentQrPayload(school: PaymentWithRelations['invoice']['school']): string | null {
    const s = school.settings;
    if (!s) return null;
    if (s.paymentQrData?.trim()) return s.paymentQrData.trim();

    const lines: string[] = [`Fee Payment - ${school.name}`];
    if (s.bankName || s.bankAccountNumber) {
      lines.push(
        `Bank: ${[s.bankName, s.bankAccountTitle, s.bankAccountNumber].filter(Boolean).join(' | ')}`,
      );
    }
    if (s.jazzCashNumber) lines.push(`JazzCash: ${s.jazzCashNumber}`);
    if (s.easyPaisaNumber) lines.push(`EasyPaisa: ${s.easyPaisaNumber}`);

    // Only the school name line means nothing was actually configured.
    return lines.length > 1 ? lines.join('\n') : null;
  }

  // Best-effort QR PNG generation — a receipt should never fail to print
  // because of a QR encoding hiccup, so this swallows errors like fetchPhoto does.
  private async generateQrBuffer(text: string): Promise<Buffer | null> {
    try {
      return await QRCode.toBuffer(text, { margin: 1, width: 240, color: { dark: '#083E28', light: '#FFFFFF' } });
    } catch (err) {
      this.logger.warn(`Could not generate payment QR code: ${(err as Error).message}`);
      return null;
    }
  }

  // Renders a single fee payment as a printable, full-colour A5 receipt PDF —
  // green/gold header band, alternating fee-head rows, and the student's
  // photo (or a placeholder avatar) in the top corner.
  async buildReceiptPdf(payment: PaymentWithRelations): Promise<Buffer> {
    const { invoice } = payment;
    const photoBuffer = await this.fetchPhoto(invoice.student.photoUrl);
    const qrPayload = this.buildPaymentQrPayload(invoice.school);
    const qrBuffer = qrPayload ? await this.generateQrBuffer(qrPayload) : null;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A5', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const money = (v: unknown) => `Rs. ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

      // ── Header band ──────────────────────────────────────────────
      const headerH = 92;
      doc.rect(0, 0, pageW, headerH).fill(BRAND_GREEN);
      doc.rect(0, headerH, pageW, 5).fill(BRAND_GOLD);

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(invoice.school.name, 36, 16, { width: pageW - 72 - 76 });
      if (invoice.branch) {
        doc.font('Helvetica').fontSize(10).text(invoice.branch.name, 36, 40, { width: pageW - 72 - 76 });
      }
      if (invoice.school.address) {
        doc.font('Helvetica').fontSize(8).fillColor('#DCEEE3').text(invoice.school.address, 36, 54, {
          width: pageW - 72 - 76,
        });
      }
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(BRAND_GOLD)
        .text('FEE RECEIPT', 36, 70);

      // Photo / avatar box, top-right of header
      const photoSize = 64;
      const photoX = pageW - 36 - photoSize;
      const photoY = 14;
      if (photoBuffer) {
        doc.save();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).clip();
        doc.image(photoBuffer, photoX, photoY, { width: photoSize, height: photoSize });
        doc.restore();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).lineWidth(2).stroke(BRAND_GOLD);
      } else {
        this.drawPlaceholderAvatar(doc, photoX, photoY, photoSize);
      }

      // ── Receipt meta ─────────────────────────────────────────────
      let y = headerH + 20;
      doc.fillColor('#000');
      const metaRow = (label: string, value: string, x: number) => {
        doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text(label, x, y);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(value, x, y + 11);
      };
      metaRow('RECEIPT NO', payment.receiptNo, 36);
      metaRow('DATE', new Date(payment.paidDate).toLocaleDateString('en-GB'), pageW / 2 + 6);
      y += 34;
      metaRow('STUDENT', invoice.student.user.fullName, 36);
      metaRow('ADMISSION NO', invoice.student.admissionNo, pageW / 2 + 6);
      y += 34;
      const classLabel = invoice.student.section
        ? `${invoice.student.section.class.name} - ${invoice.student.section.name}`
        : '—';
      metaRow('CLASS', classLabel, 36);
      metaRow('PERIOD', invoice.period, pageW / 2 + 6);
      y += 30;

      doc.moveTo(36, y).lineTo(pageW - 36, y).lineWidth(1).stroke('#D8E4DE');
      y += 12;

      // ── Fee-head breakdown table ─────────────────────────────────
      const tableLeft = 36;
      const tableRight = pageW - 36;
      const colAmount = tableRight - 140;
      const colNet = tableRight - 60;

      doc.rect(tableLeft, y, tableRight - tableLeft, 20).fill(BRAND_GREEN_DARK);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('FEE HEAD', tableLeft + 8, y + 6);
      doc.text('AMOUNT', colAmount, y + 6, { width: 70, align: 'right' });
      doc.text('NET', colNet, y + 6, { width: 60, align: 'right' });
      y += 20;

      doc.font('Helvetica').fontSize(9.5);
      invoice.items.forEach((item, idx) => {
        const rowH = 18;
        if (idx % 2 === 0) doc.rect(tableLeft, y, tableRight - tableLeft, rowH).fill(ROW_ALT);
        doc.fillColor('#222');
        doc.text(item.feeHead.name, tableLeft + 8, y + 4, { width: colAmount - tableLeft - 16 });
        doc.text(money(item.amount), colAmount, y + 4, { width: 70, align: 'right' });
        doc.text(money(item.netAmount), colNet, y + 4, { width: 60, align: 'right' });
        y += rowH;
      });

      doc.moveTo(tableLeft, y + 2).lineTo(tableRight, y + 2).lineWidth(1).stroke(BRAND_GREEN);
      y += 10;

      const summaryRow = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000');
        doc.text(label, colAmount - 90, y, { width: 90, align: 'right' });
        doc.text(value, colNet, y, { width: 60, align: 'right' });
        y += 16;
      };
      summaryRow('Invoice Total:', money(invoice.totalAmount));
      summaryRow('This Payment:', money(payment.amount), true);
      const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);

      // Balance highlight pill
      y += 4;
      const pillW = 170;
      const pillX = tableRight - pillW;
      doc.roundedRect(pillX, y, pillW, 24, 4).fill(balance > 0 ? '#FCEFEA' : '#EAF6EE');
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(balance > 0 ? '#B3441C' : BRAND_GREEN_DARK)
        .text(`Balance Remaining: ${money(Math.max(balance, 0))}`, pillX, y + 7, { width: pillW, align: 'center' });
      y += 40;

      doc.font('Helvetica').fontSize(9).fillColor('#333');
      doc.text(`Payment Method: ${payment.method ?? 'Cash'}`, 36, y);
      doc.text(`Received By: ${payment.receivedBy.fullName}`, 36, y + 14);

      // ── Payment QR (Bank / JazzCash / EasyPaisa), bottom-right — only
      // rendered when the school has configured at least one channel.
      if (qrBuffer) {
        const qrSize = 66;
        const qrX = tableRight - qrSize;
        const qrY = y - 6;
        doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 22, 4).fillAndStroke('#FFFFFF', '#D8E4DE');
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(BRAND_GREEN_DARK)
          .text('Scan to Pay', qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: 'center' });
      }

      doc.fontSize(7.5).fillColor('#999');
      doc.text(
        'This is a computer-generated receipt.',
        36,
        doc.page.height - 34,
        { align: 'center', width: doc.page.width - 72 },
      );
      doc.rect(0, doc.page.height - 10, pageW, 10).fill(BRAND_GOLD);

      doc.end();
    });
  }
}
