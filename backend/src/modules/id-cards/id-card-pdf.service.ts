import { Injectable, Logger } from '@nestjs/common';
// pdfkit ships a plain CommonJS export; this project's tsconfig doesn't set
// esModuleInterop, so a namespace import is required (see fee-receipt.service.ts).
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { fetchPersonPhoto } from '../../common/utils/photo-storage';

const BRAND_GREEN = '#0B5D3B';
const BRAND_GREEN_DARK = '#083E28';
const BRAND_GOLD = '#C9A227';
const TEXT_MUTED = '#5B6B63';

// Standard CR80 card size (the same size as a bank/NADRA card), in points
// (72 points = 1 inch): 3.375in x 2.125in.
export const CARD_WIDTH = 243;
export const CARD_HEIGHT = 153;

export type IdCardData = {
  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  logoUrl?: string | null;
  roleLabel: string; // "Student" or "Teacher / Staff"
  fullName: string;
  photoUrl?: string | null;
  identifierLabel: string; // "Admission No" or "Employee ID"
  identifierValue: string;
  subLine?: string | null; // Class/Section, or Designation/Subject
  loginId?: string | null;
  bloodGroup?: string | null;
  validThrough?: string | null; // e.g. academic year "2026-2027"
};

@Injectable()
export class IdCardPdfService {
  private readonly logger = new Logger(IdCardPdfService.name);

  // Best-effort image fetch (local upload or remote URL) - a card should
  // never fail to print just because a photo/logo is briefly unreachable
  // (same pattern as FeeReceiptService).
  private async fetchImage(value: string | null | undefined): Promise<Buffer | null> {
    return fetchPersonPhoto(value);
  }

  private async generateQrBuffer(text: string): Promise<Buffer | null> {
    try {
      return await QRCode.toBuffer(text, { margin: 0, width: 160, color: { dark: '#083E28', light: '#FFFFFF' } });
    } catch (err) {
      this.logger.warn(`Could not generate ID card QR code: ${(err as Error).message}`);
      return null;
    }
  }

  private drawPlaceholderAvatar(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
    doc.save();
    doc.roundedRect(x, y, size, size, 4).fillAndStroke('#EAF1EC', BRAND_GREEN);
    const cx = x + size / 2;
    doc.circle(cx, y + size * 0.36, size * 0.16).fill(BRAND_GREEN);
    doc
      .moveTo(x + size * 0.16, y + size * 0.92)
      .quadraticCurveTo(cx, y + size * 0.55, x + size * 0.84, y + size * 0.92)
      .lineTo(x + size * 0.84, y + size)
      .lineTo(x + size * 0.16, y + size)
      .fill(BRAND_GREEN);
    doc.restore();
  }

  // Draws one card's FRONT face inside the box (x, y, w, h) of an
  // already-open PDFDocument - used both for a single full-size card and for
  // a grid of cards on a batch print sheet.
  async drawFront(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    data: IdCardData,
    photoBuffer: Buffer | null,
    logoBuffer: Buffer | null,
    qrBuffer: Buffer | null,
  ) {
    doc.save();
    // Card outline + rounded clip so nothing draws outside the card edge.
    doc.roundedRect(x, y, w, h, 8).clip();

    doc.rect(x, y, w, h).fill('#FFFFFF');

    const headerH = h * 0.24;
    doc.rect(x, y, w, headerH).fill(BRAND_GREEN);
    doc.rect(x, y + headerH, w, 3).fill(BRAND_GOLD);

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, x + 8, y + 6, { width: headerH - 12, height: headerH - 12 });
      } catch {
        /* corrupt/unsupported image - skip silently, header still looks fine without it */
      }
    }

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(data.schoolName.toUpperCase(), x + (logoBuffer ? headerH : 10), y + 6, {
        width: w - (logoBuffer ? headerH : 10) - 8,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#DCEEE3')
      .text(data.roleLabel.toUpperCase() + ' ID CARD', x + (logoBuffer ? headerH : 10), y + 6 + 13, {
        width: w - (logoBuffer ? headerH : 10) - 8,
        align: 'center',
      });

    // ── Photo ────────────────────────────────────────────────────────
    const photoSize = h * 0.42;
    const photoX = x + 10;
    const photoY = y + headerH + 10;
    if (photoBuffer) {
      try {
        doc.save();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 4).clip();
        doc.image(photoBuffer, photoX, photoY, { width: photoSize, height: photoSize });
        doc.restore();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 4).lineWidth(1).stroke(BRAND_GREEN);
      } catch {
        this.drawPlaceholderAvatar(doc, photoX, photoY, photoSize);
      }
    } else {
      this.drawPlaceholderAvatar(doc, photoX, photoY, photoSize);
    }

    // ── Name + details, to the right of the photo ───────────────────
    const textX = photoX + photoSize + 10;
    const textW = x + w - 8 - textX;
    let ty = photoY - 2;
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(10.5).text(data.fullName, textX, ty, { width: textW });
    ty = doc.y + 2;
    if (data.subLine) {
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text(data.subLine, textX, ty, { width: textW });
      ty = doc.y + 3;
    }
    doc
      .fillColor('#111')
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(`${data.identifierLabel}: `, textX, ty, { continued: true, width: textW })
      .font('Helvetica')
      .text(data.identifierValue);
    ty = doc.y + 2;
    if (data.loginId) {
      doc
        .fillColor('#111')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('Login ID: ', textX, ty, { continued: true, width: textW })
        .font('Helvetica')
        .text(data.loginId);
      ty = doc.y + 2;
    }
    if (data.bloodGroup) {
      doc
        .fillColor('#111')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('Blood Group: ', textX, ty, { continued: true, width: textW })
        .font('Helvetica')
        .text(data.bloodGroup);
    }

    // ── QR code, bottom-right ────────────────────────────────────────
    if (qrBuffer) {
      const qrSize = h * 0.22;
      try {
        doc.image(qrBuffer, x + w - qrSize - 8, y + h - qrSize - 8, { width: qrSize, height: qrSize });
      } catch {
        /* skip */
      }
    }

    // ── Footer band ──────────────────────────────────────────────────
    doc.rect(x, y + h - 14, w, 14).fill(BRAND_GREEN_DARK);
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica')
      .fontSize(6.5)
      .text(data.validThrough ? `Valid: ${data.validThrough}` : '', x + 8, y + h - 11, { width: w - 16 });

    doc.restore();
    // Card border (drawn after restore, outside the clip, so it's crisp).
    doc.roundedRect(x, y, w, h, 8).lineWidth(1).stroke('#D8DEDA');
  }

  // Draws one card's BACK face - school contact info + a short return-if-found
  // notice, standard on printed school ID cards.
  drawBack(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, data: IdCardData) {
    doc.save();
    doc.roundedRect(x, y, w, h, 8).clip();
    doc.rect(x, y, w, h).fill('#FFFFFF');
    doc.rect(x, y, w, 10).fill(BRAND_GOLD);

    let ty = y + 20;
    doc.fillColor(BRAND_GREEN).font('Helvetica-Bold').fontSize(9).text(data.schoolName, x + 10, ty, {
      width: w - 20,
      align: 'center',
    });
    ty += 16;
    if (data.schoolAddress) {
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(7).text(data.schoolAddress, x + 10, ty, {
        width: w - 20,
        align: 'center',
      });
      ty = doc.y + 4;
    }
    if (data.schoolPhone) {
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(7).text(`Phone: ${data.schoolPhone}`, x + 10, ty, {
        width: w - 20,
        align: 'center',
      });
      ty = doc.y + 8;
    }

    doc.moveTo(x + 16, ty).lineTo(x + w - 16, ty).lineWidth(0.5).stroke('#D8DEDA');
    ty += 8;

    doc
      .fillColor('#333')
      .font('Helvetica-Oblique')
      .fontSize(7)
      .text(
        'This card is the property of the school and must be shown on request. If found, please return to the school office.',
        x + 12,
        ty,
        { width: w - 24, align: 'center', lineGap: 2 },
      );

    doc.rect(x, y + h - 10, w, 10).fill(BRAND_GREEN_DARK);
    doc.restore();
    doc.roundedRect(x, y, w, h, 8).lineWidth(1).stroke('#D8DEDA');
  }

  // Single card, front + back, each on its own page sized exactly to one card
  // - the simplest thing to print at 100% scale on a card printer.
  async buildSingleCardPdf(data: IdCardData): Promise<Buffer> {
    const [photoBuffer, logoBuffer] = await Promise.all([
      this.fetchImage(data.photoUrl),
      this.fetchImage(data.logoUrl),
    ]);
    const qrBuffer = await this.generateQrBuffer(
      JSON.stringify({ id: data.identifierValue, loginId: data.loginId, school: data.schoolName }),
    );

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        await this.drawFront(doc, 0, 0, CARD_WIDTH, CARD_HEIGHT, data, photoBuffer, logoBuffer, qrBuffer);
        doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
        this.drawBack(doc, 0, 0, CARD_WIDTH, CARD_HEIGHT, data);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Batch sheet: fronts only, laid out in a grid on A4 pages, for printing a
  // whole class/branch at once and cutting the cards apart afterwards.
  async buildBatchPdf(items: IdCardData[]): Promise<Buffer> {
    const cols = 2;
    const rows = 4;
    const perPage = cols * rows;
    const pageW = 595.28; // A4 at 72dpi
    const pageH = 841.89;
    const marginX = (pageW - cols * CARD_WIDTH) / (cols + 1);
    const marginY = (pageH - rows * CARD_HEIGHT) / (rows + 1);

    const preloaded = await Promise.all(
      items.map(async (data) => ({
        data,
        photoBuffer: await this.fetchImage(data.photoUrl),
        logoBuffer: await this.fetchImage(data.logoUrl),
        qrBuffer: await this.generateQrBuffer(
          JSON.stringify({ id: data.identifierValue, loginId: data.loginId, school: data.schoolName }),
        ),
      })),
    );

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        for (let i = 0; i < preloaded.length; i++) {
          const positionOnPage = i % perPage;
          if (i > 0 && positionOnPage === 0) doc.addPage({ size: 'A4', margin: 0 });

          const col = positionOnPage % cols;
          const row = Math.floor(positionOnPage / cols);
          const x = marginX + col * (CARD_WIDTH + marginX);
          const y = marginY + row * (CARD_HEIGHT + marginY);

          const { data, photoBuffer, logoBuffer, qrBuffer } = preloaded[i];
          await this.drawFront(doc, x, y, CARD_WIDTH, CARD_HEIGHT, data, photoBuffer, logoBuffer, qrBuffer);
        }

        if (preloaded.length === 0) {
          doc.font('Helvetica').fontSize(12).text('No records to print.', 40, 40);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
