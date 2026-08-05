import { Injectable } from '@nestjs/common';
// pdfkit ships a plain CommonJS export; this project's tsconfig doesn't set
// esModuleInterop, so a namespace import is required (see fee-receipt.service.ts).
import * as PDFDocument from 'pdfkit';

const BRAND_GREEN = '#0B5D3B';
const BRAND_GREEN_DARK = '#083E28';
const BRAND_GOLD = '#C9A227';
const TEXT_MUTED = '#5B6B63';
const ROW_ALT = '#F2F7F4';

export type MigrationCertificateData = {
  fatherName?: string | null;
  dateOfBirth?: Date | null;
  admissionDate?: Date | null;
  marksObtained?: number | null;
  marksOutOf?: number | null;
  attendanceDays?: number | null;
  totalWorkingDays?: number | null;
  duesAmount?: number | null;
  duesPaidTill?: Date | null;
  transferDate?: Date | null;
  shiftedToSchool?: string | null;
};

export type CertificatePdfData = {
  schoolName: string;
  schoolAddress?: string | null;
  certificateNo: string;
  type: string;
  title: string;
  bodyText: string;
  holderName: string;
  admissionNo?: string | null;
  className?: string | null;
  issuedDate: Date;
  qrVerifyToken: string;
  migration?: MigrationCertificateData;
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

// Small English number-to-words converter, good enough for calendar days
// (1-31) and years (e.g. 2026) - used to print "Date of Birth in Words"
// the way the school's older leaving certificates did.
function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return `Minus ${numberToWords(-n)}`;
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + numberToWords(n % 100) : ''}`;
  if (n < 1_000_000) return `${numberToWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + numberToWords(n % 1000) : ''}`;
  return String(n);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dateInWords(d: Date): string {
  return `${numberToWords(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${numberToWords(d.getFullYear())}`;
}

function fmtDate(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('en-GB') : '—';
}

@Injectable()
export class CertificatePdfService {
  async buildCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
    if (data.type === 'MIGRATION' && data.migration) {
      return this.buildMigrationCertificate(data, data.migration);
    }
    return this.buildGenericCertificate(data);
  }

  // ── Generic certificate (Character, Bonafide, Experience, etc.) ────────
  // A short centered statement inside a decorative landscape border.
  private async buildGenericCertificate(data: CertificatePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const left = 56;
      const right = pageW - 56;

      // ── Decorative border ───────────────────────────────────────
      doc.rect(20, 20, pageW - 40, pageH - 40).lineWidth(2).stroke(BRAND_GOLD);
      doc.rect(28, 28, pageW - 56, pageH - 56).lineWidth(1).stroke(BRAND_GREEN);

      // ── Header ───────────────────────────────────────────────────
      let y = 56;
      doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(24).text(data.schoolName, left, y, {
        width: right - left,
        align: 'center',
      });
      y += 30;
      if (data.schoolAddress) {
        doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(10).text(data.schoolAddress, left, y, {
          width: right - left,
          align: 'center',
        });
        y += 18;
      }
      doc.moveTo(pageW / 2 - 60, y + 4).lineTo(pageW / 2 + 60, y + 4).lineWidth(2).stroke(BRAND_GOLD);
      y += 26;

      doc.fillColor(BRAND_GOLD).font('Helvetica-Bold').fontSize(20).text(data.title.toUpperCase(), left, y, {
        width: right - left,
        align: 'center',
      });
      y += 44;

      // ── Body ─────────────────────────────────────────────────────
      doc.fillColor('#222').font('Helvetica').fontSize(13).text(data.bodyText, left + 40, y, {
        width: right - left - 80,
        align: 'center',
        lineGap: 6,
      });
      y = doc.y + 30;

      // ── Meta row ─────────────────────────────────────────────────
      doc.fontSize(10).fillColor(TEXT_MUTED);
      const metaParts = [`Certificate No: ${data.certificateNo}`, `Issued: ${data.issuedDate.toLocaleDateString('en-GB')}`];
      if (data.admissionNo) metaParts.push(`Admission No: ${data.admissionNo}`);
      if (data.className) metaParts.push(`Class: ${data.className}`);
      doc.font('Helvetica-Bold').text(metaParts.join('   |   '), left, y, { width: right - left, align: 'center' });

      // ── Signatures ───────────────────────────────────────────────
      const sigY = pageH - 110;
      doc.moveTo(left + 20, sigY).lineTo(left + 200, sigY).lineWidth(1).stroke('#999');
      doc.moveTo(right - 200, sigY).lineTo(right - 20, sigY).lineWidth(1).stroke('#999');
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_MUTED);
      doc.text('Principal', left + 20, sigY + 4, { width: 180, align: 'center' });
      doc.text('Registrar / Director', right - 200, sigY + 4, { width: 180, align: 'center' });

      // ── Verification footer ─────────────────────────────────────
      doc.fontSize(8).fillColor(TEXT_MUTED).text(
        `Verify this certificate's authenticity at your school portal using code: ${data.qrVerifyToken}`,
        left,
        pageH - 50,
        { width: right - left, align: 'center' },
      );
      doc.rect(20, pageH - 30, pageW - 40, 10).fill(BRAND_GREEN_DARK);

      doc.end();
    });
  }

  // ── Migration / School Leaving Certificate ──────────────────────────
  // Portrait, data-table layout - same fields the school's legacy system
  // printed (admission/attendance/marks/dues/transfer), fresh modern design.
  private async buildMigrationCertificate(data: CertificatePdfData, m: MigrationCertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'portrait' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const left = 48;
      const right = pageW - 48;

      doc.rect(16, 16, pageW - 32, pageH - 32).lineWidth(1.5).stroke(BRAND_GOLD);

      // ── Header band ──────────────────────────────────────────────
      const headerH = 92;
      doc.rect(16, 16, pageW - 32, headerH).fill(BRAND_GREEN);
      doc.rect(16, 16 + headerH, pageW - 32, 5).fill(BRAND_GOLD);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(19).text(data.schoolName, left, 34, {
        width: right - left,
        align: 'center',
      });
      if (data.schoolAddress) {
        doc.font('Helvetica').fontSize(9.5).fillColor('#DCEEE3').text(data.schoolAddress, left, 58, {
          width: right - left,
          align: 'center',
        });
      }
      doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_GOLD).text('MIGRATION / SCHOOL LEAVING CERTIFICATE', left, 76, {
        width: right - left,
        align: 'center',
      });

      let y = 16 + headerH + 24;

      // ── Serial / issue meta ──────────────────────────────────────
      doc.font('Helvetica').fontSize(9).fillColor(TEXT_MUTED);
      doc.text(`Certificate No: ${data.certificateNo}`, left, y);
      doc.text(`Date: ${fmtDate(data.issuedDate)}`, left, y, { width: right - left, align: 'right' });
      y += 22;

      // ── Data table ───────────────────────────────────────────────
      const rows: [string, string][] = [
        ['Admission No', data.admissionNo ?? '—'],
        ["Student's Name", data.holderName],
        ["Father's Name", m.fatherName ?? '—'],
        ['Date of Birth', m.dateOfBirth ? `${fmtDate(m.dateOfBirth)} (${dateInWords(new Date(m.dateOfBirth))})` : '—'],
        ['Class', data.className ?? '—'],
        ['Marks in Annual Examination', m.marksObtained != null && m.marksOutOf != null ? `${m.marksObtained} out of ${m.marksOutOf}` : 'N/A'],
        ['Date of Admission', fmtDate(m.admissionDate)],
        [
          'Attendance',
          m.attendanceDays != null && m.totalWorkingDays != null ? `${m.attendanceDays} out of ${m.totalWorkingDays} working days` : '—',
        ],
        ['Date of Transfer', fmtDate(m.transferDate)],
        ['School Dues', m.duesAmount != null ? `Rs. ${m.duesAmount.toLocaleString()}` : 'Rs. 0'],
        ['Dues Paid Till', fmtDate(m.duesPaidTill)],
        ['Shifted To School', m.shiftedToSchool ?? '—'],
      ];

      const labelW = 190;
      doc.font('Helvetica').fontSize(10);
      rows.forEach(([label, value], idx) => {
        const rowH = 22;
        if (idx % 2 === 0) doc.rect(left, y, right - left, rowH).fill(ROW_ALT);
        doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').text(label, left + 8, y + 6, { width: labelW });
        doc.fillColor('#1a1a1a').font('Helvetica').text(value, left + labelW + 16, y + 6, { width: right - left - labelW - 24 });
        y += rowH;
      });

      y += 20;

      // ── Certification statement ─────────────────────────────────
      doc.font('Helvetica').fontSize(10.5).fillColor('#222').text(
        'Certified that the above information is in accordance with the school record. We wish him/her a happy success in every sphere of life.',
        left,
        y,
        { width: right - left, align: 'left', lineGap: 4 },
      );
      y = doc.y + 40;

      // ── Signatures ───────────────────────────────────────────────
      const sigLabels = ['Prepared by', 'Checked by', 'Principal'];
      const sigW = (right - left - 40) / 3;
      sigLabels.forEach((label, i) => {
        const sx = left + i * (sigW + 20);
        doc.moveTo(sx, y).lineTo(sx + sigW, y).lineWidth(1).stroke('#999');
        doc.font('Helvetica').fontSize(9).fillColor(TEXT_MUTED).text(label, sx, y + 4, { width: sigW, align: 'center' });
      });

      // ── Verification footer ─────────────────────────────────────
      doc.fontSize(7.5).fillColor(TEXT_MUTED).text(
        `Verify this certificate's authenticity at your school portal using code: ${data.qrVerifyToken}`,
        left,
        pageH - 44,
        { width: right - left, align: 'center' },
      );
      doc.rect(16, pageH - 26, pageW - 32, 10).fill(BRAND_GREEN_DARK);

      doc.end();
    });
  }
}
