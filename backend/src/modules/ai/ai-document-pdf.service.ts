import { Injectable } from '@nestjs/common';
// pdfkit ships a plain CommonJS export; this project's tsconfig doesn't set
// esModuleInterop, so a namespace import is required (see fee-receipt.service.ts).
import * as PDFDocument from 'pdfkit';
import { QuestionPaperContent } from './ai-question-paper.service';
import { LessonPlanContent } from './ai-lesson-plan.service';

const BRAND_GREEN = '#0B5D3B';
const BRAND_GOLD = '#C9A227';
const TEXT_MUTED = '#5B6B63';

type QuestionPaperMeta = {
  title: string;
  schoolName: string;
  examType?: string | null;
  subjectName?: string | null;
  className?: string | null;
  totalMarks: number;
  durationMinutes?: number | null;
  instructions?: string | null;
};

type LessonPlanMeta = {
  topic: string;
  schoolName: string;
  subjectName?: string | null;
  className?: string | null;
  durationMinutes?: number | null;
};

@Injectable()
export class AiDocumentPdfService {
  private drawHeader(doc: PDFKit.PDFDocument, schoolName: string, subtitle: string) {
    const pageW = doc.page.width;
    doc.rect(0, 0, pageW, 70).fill(BRAND_GREEN);
    doc.rect(0, 70, pageW, 3).fill(BRAND_GOLD);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text(schoolName, 40, 20, { width: pageW - 80 });
    doc.font('Helvetica').fontSize(10).fillColor('#DCEEE3').text(subtitle, 40, 44, { width: pageW - 80 });
    doc.fillColor('#111');
  }

  // pdfkit's stream is push-based (data/end events), so PDF generation is
  // async even though nothing else here awaits anything - the caller gets a
  // Buffer once the 'end' event actually fires, same pattern as every other
  // PDF service in this codebase (fee-receipt.service.ts, certificate-pdf.service.ts).
  async buildQuestionPaperPdf(meta: QuestionPaperMeta, content: QuestionPaperContent): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, meta.schoolName, meta.examType ? `${meta.examType} - Question Paper` : 'Question Paper');

      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#111').text(meta.title, { align: 'center' });
      doc.moveDown(0.3);

      const metaLine = [
        meta.subjectName ? `Subject: ${meta.subjectName}` : null,
        meta.className ? `Class: ${meta.className}` : null,
        `Total Marks: ${meta.totalMarks}`,
        meta.durationMinutes ? `Time: ${meta.durationMinutes} minutes` : null,
      ]
        .filter(Boolean)
        .join('     ');
      doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(metaLine, { align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).lineWidth(0.5).stroke('#D8DEDA');
      doc.moveDown(0.7);

      if (meta.instructions) {
        doc
          .font('Helvetica-Oblique')
          .fontSize(9.5)
          .fillColor(TEXT_MUTED)
          .text(`Instructions: ${meta.instructions}`, { width: doc.page.width - 80 });
        doc.moveDown(0.8);
      }

      for (const section of content.sections ?? []) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc
          .font('Helvetica-Bold')
          .fontSize(11.5)
          .fillColor(BRAND_GREEN)
          .text(`${section.title}  (${section.marks} marks)`, { width: doc.page.width - 80 });
        doc.moveDown(0.4);

        section.questions.forEach((q, i) => {
          if (doc.y > doc.page.height - 90) doc.addPage();
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#111')
            .text(`${i + 1}. `, { continued: true, width: doc.page.width - 80 })
            .font('Helvetica')
            .text(`${q.text}  [${q.marks}]`);

          if (q.options?.length) {
            doc.moveDown(0.15);
            const optionLetters = ['A', 'B', 'C', 'D'];
            q.options.forEach((opt, oi) => {
              doc
                .font('Helvetica')
                .fontSize(9.5)
                .fillColor(TEXT_MUTED)
                .text(`   ${optionLetters[oi] ?? oi + 1}) ${opt}`, { width: doc.page.width - 100 });
            });
          }
          doc.moveDown(0.5);
        });
        doc.moveDown(0.4);
      }

      doc.end();
    });
  }

  async buildLessonPlanPdf(meta: LessonPlanMeta, content: LessonPlanContent): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, meta.schoolName, 'Lesson Plan');

      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#111').text(meta.topic, { align: 'center' });
      doc.moveDown(0.3);

      const metaLine = [
        meta.subjectName ? `Subject: ${meta.subjectName}` : null,
        meta.className ? `Class: ${meta.className}` : null,
        meta.durationMinutes ? `Duration: ${meta.durationMinutes} minutes` : null,
      ]
        .filter(Boolean)
        .join('     ');
      doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(metaLine, { align: 'center' });
      doc.moveDown(0.8);

      const section = (title: string, body: () => void) => {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(11.5).fillColor(BRAND_GREEN).text(title);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10).fillColor('#111');
        body();
        doc.moveDown(0.7);
      };

      section('Learning Objectives', () => {
        (content.objectives ?? []).forEach((o) => doc.text(`•  ${o}`, { width: doc.page.width - 80 }));
      });
      section('Materials Needed', () => {
        (content.materials ?? []).forEach((m) => doc.text(`•  ${m}`, { width: doc.page.width - 80 }));
      });
      section('Warm-up', () => {
        doc.text(content.warmUp ?? '', { width: doc.page.width - 80 });
      });
      section('Main Activities', () => {
        (content.mainActivities ?? []).forEach((a, i) => doc.text(`${i + 1}. ${a}`, { width: doc.page.width - 80 }));
      });
      section('Assessment', () => {
        doc.text(content.assessment ?? '', { width: doc.page.width - 80 });
      });
      section('Homework', () => {
        doc.text(content.homework ?? '', { width: doc.page.width - 80 });
      });

      doc.end();
    });
  }
}
