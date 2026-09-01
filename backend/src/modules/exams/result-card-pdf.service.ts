import { Injectable, Logger } from '@nestjs/common';
// pdfkit ships a plain CommonJS export; this project's tsconfig doesn't set
// esModuleInterop, so a namespace import is required (see fee-receipt.service.ts).
import * as PDFDocument from 'pdfkit';
import { fetchPersonPhoto } from '../../common/utils/photo-storage';

const BRAND_GREEN = '#0B5D3B';
const BRAND_GREEN_DARK = '#083E28';
const BRAND_GOLD = '#C9A227';
const ROW_ALT = '#F2F7F4';
const TEXT_MUTED = '#5B6B63';
const PASS_BG = '#EAF6EE';
const PASS_TEXT = '#0B5D3B';
const FAIL_BG = '#FCEFEA';
const FAIL_TEXT = '#B3441C';

export type ReportCardData = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  photoUrl?: string | null;
  className: string | null;
  sectionName: string | null;
  schoolName: string;
  schoolAddress?: string | null;
  branchName?: string | null;
  guardianName?: string | null;
  examId: string;
  examName: string;
  subjects: {
    subject: string;
    maxMarks: number;
    passingMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    passed: boolean | null;
  }[];
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  grade: string | null;
  overallResult: 'PASS' | 'FAIL' | null;
};

@Injectable()
export class ResultCardPdfService {
  private readonly logger = new Logger(ResultCardPdfService.name);

  private async fetchPhoto(url: string | null | undefined): Promise<Buffer | null> {
    return fetchPersonPhoto(url);
  }

  private drawPlaceholderAvatar(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
    doc.save();
    doc.roundedRect(x, y, size, size, 6).fillAndStroke('#EAF1EC', BRAND_GREEN);
    const cx = x + size / 2;
    doc.circle(cx, y + size * 0.38, size * 0.16).fill(BRAND_GREEN);
    doc
      .moveTo(x + size * 0.18, y + size * 0.88)
      .quadraticCurveTo(cx, y + size * 0.55, x + size * 0.82, y + size * 0.88)
      .lineTo(x + size * 0.82, y + size)
      .lineTo(x + size * 0.18, y + size)
      .fill(BRAND_GREEN);
    doc.restore();
  }

  async buildReportCardPdf(data: ReportCardData): Promise<Buffer> {
    const photoBuffer = await this.fetchPhoto(data.photoUrl);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const left = 40;
      const right = pageW - 40;

      // ── Header band ──────────────────────────────────────────────
      const headerH = 100;
      doc.rect(0, 0, pageW, headerH).fill(BRAND_GREEN);
      doc.rect(0, headerH, pageW, 6).fill(BRAND_GOLD);

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(data.schoolName, left, 20, {
        width: pageW - 80 - 90,
      });
      if (data.branchName) {
        doc.font('Helvetica').fontSize(11).text(data.branchName, left, 46, { width: pageW - 80 - 90 });
      }
      if (data.schoolAddress) {
        doc.font('Helvetica').fontSize(9).fillColor('#DCEEE3').text(data.schoolAddress, left, 62, {
          width: pageW - 80 - 90,
        });
      }
      doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_GOLD).text('REPORT CARD', left, 78);

      const photoSize = 76;
      const photoX = right - photoSize;
      const photoY = 16;
      if (photoBuffer) {
        doc.save();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).clip();
        doc.image(photoBuffer, photoX, photoY, { width: photoSize, height: photoSize });
        doc.restore();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).lineWidth(2).stroke(BRAND_GOLD);
      } else {
        this.drawPlaceholderAvatar(doc, photoX, photoY, photoSize);
      }

      // ── Student meta ─────────────────────────────────────────────
      let y = headerH + 22;
      const metaRow = (label: string, value: string, x: number, width: number) => {
        doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text(label, x, y);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(value || '—', x, y + 11, { width });
      };
      const colW = (right - left - 24) / 3;
      metaRow('STUDENT NAME', data.fullName, left, colW);
      metaRow('ADMISSION NO', data.admissionNo, left + colW + 12, colW);
      metaRow('EXAM', data.examName, left + 2 * (colW + 12), colW);
      y += 36;
      const classLabel = data.className ? `${data.className}${data.sectionName ? ' - ' + data.sectionName : ''}` : '—';
      metaRow('CLASS', classLabel, left, colW);
      metaRow('GUARDIAN', data.guardianName ?? '—', left + colW + 12, colW);
      y += 34;

      doc.moveTo(left, y).lineTo(right, y).lineWidth(1).stroke('#D8E4DE');
      y += 14;

      // ── Subjects table ───────────────────────────────────────────
      const colSubject = left;
      const colMax = right - 260;
      const colPass = right - 190;
      const colObt = right - 120;
      const colGrade = right - 50;

      doc.rect(left, y, right - left, 22).fill(BRAND_GREEN_DARK);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('SUBJECT', colSubject + 8, y + 7);
      doc.text('MAX', colMax, y + 7, { width: 60, align: 'right' });
      doc.text('PASSING', colPass, y + 7, { width: 60, align: 'right' });
      doc.text('OBTAINED', colObt, y + 7, { width: 60, align: 'right' });
      doc.text('RESULT', colGrade, y + 7, { width: 44, align: 'right' });
      y += 22;

      doc.font('Helvetica').fontSize(10);
      data.subjects.forEach((s, idx) => {
        const rowH = 22;
        if (idx % 2 === 0) doc.rect(left, y, right - left, rowH).fill(ROW_ALT);
        doc.fillColor('#222');
        doc.text(s.subject, colSubject + 8, y + 6, { width: colMax - colSubject - 16 });
        doc.text(String(s.maxMarks), colMax, y + 6, { width: 60, align: 'right' });
        doc.text(String(s.passingMarks), colPass, y + 6, { width: 60, align: 'right' });
        doc.text(s.isAbsent ? 'Absent' : String(s.marksObtained ?? '—'), colObt, y + 6, {
          width: 60,
          align: 'right',
        });
        const passed = s.passed;
        doc
          .fillColor(passed === false ? FAIL_TEXT : passed === true ? PASS_TEXT : TEXT_MUTED)
          .font('Helvetica-Bold')
          .text(passed === false ? 'Fail' : passed === true ? 'Pass' : '—', colGrade, y + 6, {
            width: 44,
            align: 'right',
          });
        doc.font('Helvetica');
        y += rowH;
      });

      doc.moveTo(left, y + 2).lineTo(right, y + 2).lineWidth(1).stroke(BRAND_GREEN);
      y += 16;

      // ── Summary ──────────────────────────────────────────────────
      const summaryLeft = left;
      const summaryW = (right - left) * 0.55;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
      doc.text(`Total: ${data.totalObtained} / ${data.totalMax}`, summaryLeft, y);
      doc.text(`Percentage: ${data.percentage !== null ? data.percentage + '%' : '—'}`, summaryLeft, y + 18);
      doc.text(`Grade: ${data.grade ?? '—'}`, summaryLeft, y + 36);

      const resultPass = data.overallResult === 'PASS';
      const pillW = 160;
      const pillX = right - pillW;
      const pillY = y;
      doc.roundedRect(pillX, pillY, pillW, 44, 6).fill(resultPass ? PASS_BG : FAIL_BG);
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(resultPass ? PASS_TEXT : FAIL_TEXT)
        .text(data.overallResult ?? '—', pillX, pillY + 12, { width: pillW, align: 'center' });

      y += 80;

      // ── Signatures ───────────────────────────────────────────────
      doc.moveTo(left, y).lineTo(left + 140, y).stroke('#999');
      doc.moveTo(right - 140, y).lineTo(right, y).stroke('#999');
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED);
      doc.text('Class Teacher', left, y + 4, { width: 140, align: 'center' });
      doc.text('Principal', right - 140, y + 4, { width: 140, align: 'center' });

      doc.fontSize(7.5).fillColor('#999');
      doc.text('This is a computer-generated report card.', left, doc.page.height - 40, {
        align: 'center',
        width: right - left,
      });
      doc.rect(0, doc.page.height - 12, pageW, 12).fill(BRAND_GOLD);

      doc.end();
    });
  }
}
