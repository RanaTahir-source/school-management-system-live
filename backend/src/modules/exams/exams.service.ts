import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto, UpdateExamDto } from './dto/create-exam.dto';
import { CreateExamSubjectDto, UpdateExamSubjectDto } from './dto/create-exam-subject.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExamDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.exam.create({
      data: {
        schoolId: dto.schoolId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, academicYearId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.exam.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, deletedAt: null },
      include: {
        examSubjects: {
          include: { subject: true, class: { select: { id: true, name: true } } },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    assertSchoolAccess(currentUser, exam.schoolId);
    return exam;
  }

  async update(id: string, dto: UpdateExamDto, currentUser: ScopedUser) {
    const exam = await this.findExamOrThrow(id, currentUser);

    if (dto.academicYearId && dto.academicYearId !== exam.academicYearId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, deletedAt: null },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      if (year.schoolId !== exam.schoolId) {
        throw new ConflictException('This academic year belongs to a different school than the exam');
      }
    }

    const updated = await this.prisma.exam.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: exam.schoolId,
        action: 'EXAM_UPDATED',
        entity: 'Exam',
        entityId: id,
      },
    });

    return updated;
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findExamOrThrow(id, currentUser);
    return this.prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Exam subjects ("papers": a subject within an exam, for one class) ──

  async addSubject(examId: string, dto: CreateExamSubjectDto, currentUser: ScopedUser) {
    const exam = await this.findExamOrThrow(examId, currentUser);

    const [klass, subject] = await Promise.all([
      this.prisma.class.findFirst({ where: { id: dto.classId, deletedAt: null } }),
      this.prisma.subject.findFirst({ where: { id: dto.subjectId, deletedAt: null } }),
    ]);
    if (!klass) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.schoolId !== exam.schoolId) {
      throw new ConflictException('This subject belongs to a different school than the exam');
    }
    if (dto.passingMarks > dto.maxMarks) {
      throw new ConflictException('passingMarks cannot be greater than maxMarks');
    }

    const existing = await this.prisma.examSubject.findFirst({
      where: { examId, classId: dto.classId, subjectId: dto.subjectId },
    });
    if (existing) {
      throw new ConflictException('This subject is already added to this exam for this class');
    }

    return this.prisma.examSubject.create({
      data: {
        examId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        maxMarks: dto.maxMarks,
        passingMarks: dto.passingMarks,
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
      },
    });
  }

  async listSubjects(examId: string, currentUser: ScopedUser, classId?: string) {
    await this.findExamOrThrow(examId, currentUser);
    return this.prisma.examSubject.findMany({
      where: { examId, ...(classId ? { classId } : {}) },
      include: { subject: true, class: { select: { id: true, name: true } } },
      orderBy: { examDate: 'asc' },
    });
  }

  async updateSubject(examSubjectId: string, dto: UpdateExamSubjectDto, currentUser: ScopedUser) {
    const paper = await this.findExamSubjectOrThrow(examSubjectId, currentUser);
    const maxMarks = dto.maxMarks ?? paper.maxMarks;
    const passingMarks = dto.passingMarks ?? paper.passingMarks;
    if (passingMarks > maxMarks) {
      throw new ConflictException('passingMarks cannot be greater than maxMarks');
    }

    // Same guard as removeSubject(): once marks are entered against this
    // paper, changing its marks scale would silently desync every already-
    // recorded ExamResult (a 45/50 becomes meaningless if maxMarks changes
    // to 100). examDate is unaffected by this and stays freely editable.
    const scaleChanging = dto.maxMarks !== undefined || dto.passingMarks !== undefined;
    if (scaleChanging) {
      const resultCount = await this.prisma.examResult.count({ where: { examSubjectId } });
      if (resultCount > 0) {
        throw new ConflictException(
          'Marks have already been entered for this paper - cannot change its marks scale without risking data inconsistency',
        );
      }
    }

    const updated = await this.prisma.examSubject.update({
      where: { id: examSubjectId },
      data: {
        ...dto,
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: paper.exam.schoolId,
        action: 'EXAM_PAPER_UPDATED',
        entity: 'ExamSubject',
        entityId: examSubjectId,
      },
    });

    return updated;
  }

  async removeSubject(examSubjectId: string, currentUser: ScopedUser) {
    await this.findExamSubjectOrThrow(examSubjectId, currentUser);
    const resultCount = await this.prisma.examResult.count({ where: { examSubjectId } });
    if (resultCount > 0) {
      throw new ConflictException(
        'Marks have already been entered for this paper - cannot remove it without losing that data',
      );
    }
    return this.prisma.examSubject.delete({ where: { id: examSubjectId } });
  }

  private async findExamOrThrow(id: string, currentUser: ScopedUser) {
    const exam = await this.prisma.exam.findFirst({ where: { id, deletedAt: null } });
    if (!exam) throw new NotFoundException('Exam not found');
    assertSchoolAccess(currentUser, exam.schoolId);
    return exam;
  }

  private async findExamSubjectOrThrow(id: string, currentUser: ScopedUser) {
    const paper = await this.prisma.examSubject.findFirst({
      where: { id },
      include: { exam: { select: { schoolId: true } } },
    });
    if (!paper) throw new NotFoundException('Exam subject (paper) not found');
    assertSchoolAccess(currentUser, paper.exam.schoolId);
    return paper;
  }
}
