import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { AnthropicClientService } from './anthropic-client.service';
import { GenerateLessonPlanDto } from './dto/generate-lesson-plan.dto';
import { UpdateAiDocumentDto } from './dto/update-ai-document.dto';

export type LessonPlanContent = {
  objectives: string[];
  materials: string[];
  warmUp: string;
  mainActivities: string[];
  assessment: string;
  homework: string;
};

const SYSTEM_PROMPT = `You are an experienced school teacher writing a lesson plan for a class in Pakistan.
Respond with ONLY a single JSON object, no markdown fences, no commentary before or after it.
The JSON must match exactly this shape:
{
  "objectives": string[],
  "materials": string[],
  "warmUp": string,
  "mainActivities": string[],
  "assessment": string,
  "homework": string
}
Rules:
- "objectives" should be 3-5 clear, measurable learning objectives for this specific topic and class level.
- "materials" should list what the teacher needs (textbook pages, board, charts, real objects, etc.) - be specific and practical for a typical Pakistani classroom (assume no smart boards/projectors unless the instructions say otherwise).
- "warmUp" is a short (2-5 minute) activity or question to open the lesson.
- "mainActivities" is an ordered list of teaching steps covering the bulk of the class period.
- "assessment" describes how the teacher will check understanding during/after the lesson (a few sentences).
- "homework" is a short, specific take-home task tied directly to the lesson.
- Keep language plain and directly usable by a teacher, not academic jargon.`;

@Injectable()
export class AiLessonPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AnthropicClientService,
  ) {}

  async generate(dto: GenerateLessonPlanDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const [subject, klass] = await Promise.all([
      dto.subjectId ? this.prisma.subject.findUnique({ where: { id: dto.subjectId } }) : null,
      dto.classId ? this.prisma.class.findUnique({ where: { id: dto.classId } }) : null,
    ]);

    const userPrompt = [
      `Topic: ${dto.topic}`,
      subject ? `Subject: ${subject.name}` : null,
      klass ? `Class/Grade: ${klass.name}` : null,
      dto.durationMinutes ? `Lesson duration: ${dto.durationMinutes} minutes` : 'Lesson duration: 40 minutes',
      dto.instructions ? `Additional instructions: ${dto.instructions}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const content = await this.ai.generateJson<LessonPlanContent>(SYSTEM_PROMPT, userPrompt);

    return this.prisma.aiLessonPlan.create({
      data: {
        schoolId: dto.schoolId,
        subjectId: dto.subjectId,
        classId: dto.classId,
        topic: dto.topic,
        durationMinutes: dto.durationMinutes,
        content: content as any,
        createdById: currentUser.userId,
      },
      include: { subject: true, class: true, createdBy: { select: { id: true, fullName: true } } },
    });
  }

  async findAll(currentUser: ScopedUser, filters: { schoolId?: string; subjectId?: string; classId?: string }) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.aiLessonPlan.findMany({
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
    const plan = await this.prisma.aiLessonPlan.findFirst({
      where: { id, deletedAt: null },
      include: { subject: true, class: true, school: true, createdBy: { select: { id: true, fullName: true } } },
    });
    if (!plan) throw new NotFoundException('Lesson plan not found');
    assertSchoolAccess(currentUser, plan.schoolId);
    return plan;
  }

  async update(id: string, dto: UpdateAiDocumentDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.aiLessonPlan.update({
      where: { id },
      data: {
        topic: dto.topic,
        durationMinutes: dto.durationMinutes,
        content: dto.content as any,
      },
      include: { subject: true, class: true, createdBy: { select: { id: true, fullName: true } } },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.aiLessonPlan.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
