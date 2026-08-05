import { Injectable } from '@nestjs/common';
// pdfkit ships a plain CommonJS export; this project's tsconfig doesn't set
// esModuleInterop, so a namespace import is required (see fee-receipt.service.ts).
import * as PDFDocument from 'pdfkit';

const BRAND_GREEN = '#0B5D3B';
const BRAND_GREEN_DARK = '#083E28';
const BRAND_GOLD = '#C9A227';
const ROW_ALT = '#F2F7F4';
const TEXT_MUTED = '#5B6B63';
const PRESENT_TEXT = '#0B5D3B';
const ABSENT_TEXT = '#B3441C';
const LATE_TEXT = '#9A6B00';
const LEAVE_TEXT = '#2A5D8A';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type AttendanceRegisterData = {
  sectionId: string;
  className: string;
  sectionName: string;
  schoolName: string;
  schoolAddress?: string | null;
  branchName?: string | null;
  classTeacherName?: string | null;
  year: number;
  month: number;
  daysInMonth: number;
  students: {
    studentId: string;
    admissionNo: string;
    fullName: string;
    marks: (string | null)[];
    present: number;
    absent: number;
    late: number;
    leave: number;
    marked: number;
    attendancePct: number | null;
  }[];
};

function codeFor(status: string | null): { label: string; color: string } {
  if (status === 'PRESENT') return { label: 'P', color: PRESENT_TEXT };
  if (status === 'ABSENT') return { label: 'A', color: ABSENT_TEXT };
  if (status === 'LATE') return { label: 'L', color: LATE_TEXT };
  if (status === 'LEAVE') return { label: 'V', color: LEAVE_TEXT };
  return { label: '-', color: '#C7D2CC' };
}

@Injectable()
export class AttendanceRegisterPdfService {
  async buildRegisterPdf(data: AttendanceRegisterData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const left = 24;
      const right = pageW - 24;

      // Column layout
      const colSr = 22;
      const colAdm = 46;
      const colName = 118;
      const fixedW = colSr + colAdm + colName;
      const sumColW = 30;
      const sumCols = 5; // P, A, L, V, %
      const sumW = sumColW * sumCols;
      const dayAreaW = right - left - fixedW - sumW;
      const dayColW = dayAreaW / data.daysInMonth;

      const headerH = 96;
      const gridHeaderH = 26;
      const rowH = 15;
      const footerH = 20;
      const rowsPerPage = Math.max(1, Math.floor((pageH - headerH - gridHeaderH - footerH - 10) / rowH));

      const monthLabel = `${MONTH_NAMES[data.month - 1]} ${data.year}`;

      function drawPageHeader() {
        doc.rect(0, 0, pageW, headerH).fill(BRAND_GREEN);
        doc.rect(0, headerH, pageW, 4).fill(BRAND_GOLD);

        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(17).text(data.schoolName, left, 14, {
          width: right - left - 200,
        });
        if (data.branchName) {
          doc.font('Helvetica').fontSize(10).text(data.branchName, left, 34, { width: right - left - 200 });
        }
        if (data.schoolAddress) {
          doc.font('Helvetica').fontSize(8.5).fillColor('#DCEEE3').text(data.schoolAddress, left, 48, {
            width: right - left - 200,
          });
        }
        doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND_GOLD).text('MONTHLY ATTENDANCE REGISTER', left, 66);

        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
        doc.text(`Class: ${data.className} - ${data.sectionName}`, right - 200, 16, { width: 200, align: 'right' });
        doc.font('Helvetica').fontSize(9.5).text(`Month: ${monthLabel}`, right - 200, 32, { width: 200, align: 'right' });
        if (data.classTeacherName) {
          doc.text(`Class Teacher: ${data.classTeacherName}`, right - 200, 48, { width: 200, align: 'right' });
        }
        doc.text(`Students: ${data.students.length}`, right - 200, 64, { width: 200, align: 'right' });
      }

      function drawGridHeader(y: number) {
        doc.rect(left, y, right - left, gridHeaderH).fill(BRAND_GREEN_DARK);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);

        let x = left;
        doc.text('#', x, y + 9, { width: colSr, align: 'center' });
        x += colSr;
        doc.text('Adm No', x, y + 9, { width: colAdm, align: 'center' });
        x += colAdm;
        doc.text('Student Name', x + 4, y + 9, { width: colName - 8 });
        x += colName;

        doc.fontSize(6);
        for (let d = 1; d <= data.daysInMonth; d++) {
          doc.text(String(d), x, y + 10, { width: dayColW, align: 'center' });
          x += dayColW;
        }

        doc.fontSize(7);
        ['P', 'A', 'L', 'V', '%'].forEach((label) => {
          doc.text(label, x, y + 9, { width: sumColW, align: 'center' });
          x += sumColW;
        });
      }

      let y = headerH + 12;
      drawPageHeader();
      drawGridHeader(y);
      y += gridHeaderH;

      let rowsOnPage = 0;
      data.students.forEach((s, idx) => {
        if (rowsOnPage >= rowsPerPage) {
          doc.addPage();
          y = headerH + 12;
          drawPageHeader();
          drawGridHeader(y);
          y += gridHeaderH;
          rowsOnPage = 0;
        }

        if (idx % 2 === 0) doc.rect(left, y, right - left, rowH).fill(ROW_ALT);

        let x = left;
        doc.fillColor('#333').font('Helvetica').fontSize(7);
        doc.text(String(idx + 1), x, y + 4, { width: colSr, align: 'center' });
        x += colSr;
        doc.text(s.admissionNo, x, y + 4, { width: colAdm, align: 'center' });
        x += colAdm;
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111');
        doc.text(s.fullName, x + 4, y + 4, { width: colName - 8, ellipsis: true });
        x += colName;

        doc.font('Helvetica-Bold').fontSize(6.5);
        for (let d = 0; d < data.daysInMonth; d++) {
          const { label, color } = codeFor(s.marks[d]);
          doc.fillColor(color).text(label, x, y + 4, { width: dayColW, align: 'center' });
          x += dayColW;
        }

        doc.font('Helvetica-Bold').fontSize(7);
        doc.fillColor(PRESENT_TEXT).text(String(s.present), x, y + 4, { width: sumColW, align: 'center' });
        x += sumColW;
        doc.fillColor(ABSENT_TEXT).text(String(s.absent), x, y + 4, { width: sumColW, align: 'center' });
        x += sumColW;
        doc.fillColor(LATE_TEXT).text(String(s.late), x, y + 4, { width: sumColW, align: 'center' });
        x += sumColW;
        doc.fillColor(LEAVE_TEXT).text(String(s.leave), x, y + 4, { width: sumColW, align: 'center' });
        x += sumColW;
        doc.fillColor('#111').text(s.attendancePct !== null ? `${s.attendancePct}%` : '-', x, y + 4, {
          width: sumColW,
          align: 'center',
        });

        y += rowH;
        rowsOnPage++;
      });

      doc.font('Helvetica').fontSize(7).fillColor(TEXT_MUTED);
      doc.text('P = Present   A = Absent   L = Late   V = Leave   - = Not marked', left, pageH - 16);
      doc.rect(0, pageH - 6, pageW, 6).fill(BRAND_GOLD);

      doc.end();
    });
  }
}
