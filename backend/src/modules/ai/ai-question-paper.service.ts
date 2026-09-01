import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { AnthropicClientService } from './anthropic-client.service';
import { GenerateQuestionPaperDto } from './dto/generate-question-paper.dto';
import { UpdateAiDocumentDto } from './dto/update-ai-document.dto';

export type QuestionPaperContent = {
  sections: {
    title: string;
    marks: number;
    questions: {
      text: string;
      marks: number;
      type: 'MCQ' | 'SHORT' | 'LONG' | 'TRUE_FALSE' | 'FILL_BLANK';
      options?: string[];
    }[];
  }[];
};

const SYSTEM_PROMPT = `You are an experienced school teacher writing an exam question paper for students in Pakistan.
Respond with ONLY a single JSON object, no markdown fences, no commentary before or after it.
The JSON must match exactly this shape:
{
  "sections": [
    {
      "title": string,
      "marks": number,
      "questions": [
        { "text": string, "marks": number, "type": "MCQ" | "SHORT" | "LONG" | "TRUE_FALSE" | "FILL_BLANK", "options": string[] (only for MCQ or TRUE_FALSE, 4 options for MCQ, 2 for TRUE_FALSE) }
      ]
    }
  ]
}
Rules:
- The sum of all section "marks" values must equal the requested total marks exactly.
- The sum of each section's question marks must equal that section's "marks" value.
- Group questions into sensible sections (e.g. "Section A - Multiple Choice Questions", "Section B - Short Questions", "Section C - Long Questions") unless the teacher's instructions say otherwise.
- Base every question strictly on the topics/chapters given - do not invent unrelated content.
- Write questions appropriate for the given class/grade level's reading and comprehension ability.
- Do not include an answer key.`;

@Injectable()
export class AiQuestionPaperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AnthropicClientService,
  ) {}

  async generate(dto: GenerateQuestionPaperDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const [subject, klass] = await Promise.all([
      dto.subjectId ? this.prisma.subject.findUnique({ where: { id: dto.subjectId } }) : null,
      dto.classId ? this.prisma.class.findUnique({ where: { id: dto.classId } }) : null,
    ]);

    const userPrompt = [
      `Title: ${dto.title}`,
      dto.examType ? `Exam type: ${dto.examType}` : null,
      subject ? `Subject: ${subject.name}` : null,
      klass ? `Class/Grade: ${klass.name}` : null,
      `Total marks: ${dto.totalMarks}`,
      dto.durationMinutes ? `Duration: ${dto.durationMinutes} minutes` : null,
      `Topics/chapters to cover: ${dto.topics}`,
      dto.instructions ? `Additional instructions: ${dto.instructions}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const content = await this.ai.generateJson<QuestionPaperContent>(SYSTEM_PROMPT, userPrompt);

    return this.prisma.aiQuestionPaper.create({
      data: {
        schoolId: dto.schoolId,
        subjectId: dto.subjectId,
        classId: dto.classId,
        title: dto.title,
        examType: dto.examType,
        totalMarks: dto.totalMarks,
        durationMinutes: dto.durationMinutes,
        instructions: dto.instructions,
        content: content as any,
        createdById: currentUser.userId,
      },
      include: { subject: true, class: true, createdBy: { select: { id: true, fullName: true } } },
    });
  }

  async findAll(currentUser: ScopedUser, filters: { schoolId?: string; subjectId?: string; classId?: string }) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.aiQuestionPaper.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(filters.classId ? { classId: filters.classId } : {}),
      },
      include: { subject: true, class: true, createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const paper = await this.prisma.aiQuestionPaper.findFirst({
      where: { id, deletedAt: null },
      include: { subject: true, class: true, school: true, createdBy: { select: { id: true, fullName: true } } },
    });
    if (!paper) throw new NotFoundException('Question paper not found');
    assertSchoolAccess(currentUser, paper.schoolId);
    return paper;
  }

  async update(id: string, dto: UpdateAiDocumentDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.aiQuestionPaper.update({
      where: { id },
      data: {
        title: dto.title,
        instructions: dto.instructions,
        totalMarks: dto.totalMarks,
        durationMinutes: dto.durationMinutes,
        content: dto.content as any,
      },
      include: { subject: true, class: true, createdBy: { select: { id: true, fullName: true } } },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.aiQuestionPaper.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
