import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkResultsDto } from './dto/mark-results.dto';
import { assertSchoolAccess } from '../../common/utils/school-scope';

type CurrentUser = { userId: string; roles: string[]; schoolId?: string | null };

const STAFF_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER'];

function calcGrade(pct: number | null): string | null {
  if (pct === null) return null;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(dto: MarkResultsDto, currentUser: CurrentUser) {
    const paper = await this.prisma.examSubject.findFirst({
      where: { id: dto.examSubjectId },
      include: { exam: { select: { schoolId: true } } },
    });
    if (!paper) throw new NotFoundException('Exam subject (paper) not found');
    assertSchoolAccess(currentUser, paper.exam.schoolId);

    const studentIds = dto.entries.map((e) => e.studentId);
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: { id: true, section: { select: { classId: true } } },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const missing = studentIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(`Unknown student id(s): ${missing.join(', ')}`);
    }

    const wrongClass = students.filter((s) => s.section?.classId !== paper.classId);
    if (wrongClass.length) {
      throw new BadRequestException(
        `These students are not enrolled in the class this paper belongs to: ${wrongClass
          .map((s) => s.id)
          .join(', ')}`,
      );
    }

    for (const entry of dto.entries) {
      if (!entry.isAbsent) {
        if (entry.marksObtained === undefined || entry.marksObtained === null) {
          throw new BadRequestException(
            `marksObtained is required for student ${entry.studentId} unless isAbsent is true`,
          );
        }
        if (entry.marksObtained > paper.maxMarks) {
          throw new BadRequestException(
            `marksObtained (${entry.marksObtained}) exceeds maxMarks (${paper.maxMarks}) for student ${entry.studentId}`,
          );
        }
      }
    }

    return this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.examResult.upsert({
          where: {
            examSubjectId_studentId: { examSubjectId: dto.examSubjectId, studentId: entry.studentId },
          },
          update: {
            marksObtained: entry.isAbsent ? null : entry.marksObtained,
            isAbsent: !!entry.isAbsent,
            remarks: entry.remarks,
            enteredById: currentUser.userId,
          },
          create: {
            examSubjectId: dto.examSubjectId,
            studentId: entry.studentId,
            marksObtained: entry.isAbsent ? null : entry.marksObtained,
            isAbsent: !!entry.isAbsent,
            remarks: entry.remarks,
            enteredById: currentUser.userId,
          },
        }),
      ),
    );
  }

  // Mark-sheet for one paper: every student in that class + their marks (null if not entered).
  async findByExamSubject(examSubjectId: string, currentUser: CurrentUser) {
    const paper = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId },
      include: { subject: true, class: { select: { name: true } }, exam: { select: { schoolId: true } } },
    });
    if (!paper) throw new NotFoundException('Exam subject (paper) not found');
    assertSchoolAccess(currentUser, paper.exam.schoolId);

    const [students, results] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where: { deletedAt: null, section: { classId: paper.classId } },
        include: { user: { select: { fullName: true } } },
        orderBy: { admissionNo: 'asc' },
      }),
      this.prisma.examResult.findMany({ where: { examSubjectId } }),
    ]);

    const byStudent = new Map(results.map((r) => [r.studentId, r]));

    return {
      subject: paper.subject.name,
      className: paper.class.name,
      maxMarks: paper.maxMarks,
      passingMarks: paper.passingMarks,
      students: students.map((s) => {
        const r = byStudent.get(s.id);
        return {
          studentId: s.id,
          admissionNo: s.admissionNo,
          fullName: s.user.fullName,
          marksObtained: r?.marksObtained ?? null,
          isAbsent: r?.isAbsent ?? false,
          remarks: r?.remarks ?? null,
          passed: r && !r.isAbsent && r.marksObtained !== null ? r.marksObtained >= paper.passingMarks : null,
        };
      }),
    };
  }

  // Full report card: every paper of an exam for the student's class, totals, %, grade.
  async reportCard(studentId: string, examId: string, currentUser: CurrentUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: {
        user: {
          select: {
            fullName: true,
            schoolId: true,
            school: { select: { name: true, address: true } },
            branch: { select: { name: true } },
          },
        },
        section: { select: { classId: true, name: true, class: { select: { name: true } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const isStaff = currentUser.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
    if (!isStaff) {
      if (currentUser.roles.includes('PARENT')) {
        const link = await this.prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: currentUser.userId, studentId } },
        });
        if (!link) throw new ForbiddenException('This student is not linked to your account');
      } else if (student.userId !== currentUser.userId) {
        throw new ForbiddenException('You can only view your own report card');
      }
    }
    if (isStaff) {
      assertSchoolAccess(currentUser, student.user.schoolId);
    }

    const exam = await this.prisma.exam.findFirst({ where: { id: examId, deletedAt: null } });
    if (!exam) throw new NotFoundException('Exam not found');

    if (!student.sectionId) {
      throw new BadRequestException('This student is not assigned to a section/class');
    }

    const papers = await this.prisma.examSubject.findMany({
      where: { examId, classId: student.section!.classId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });

    const results = await this.prisma.examResult.findMany({
      where: { examSubjectId: { in: papers.map((p) => p.id) }, studentId },
    });
    const byPaper = new Map(results.map((r) => [r.examSubjectId, r]));

    let totalObtained = 0;
    let totalMax = 0;
    const subjects = papers.map((p) => {
      const r = byPaper.get(p.id);
      const obtained = r && !r.isAbsent ? r.marksObtained ?? 0 : 0;
      totalMax += p.maxMarks;
      if (r && !r.isAbsent) totalObtained += obtained;
      return {
        subject: p.subject.name,
        maxMarks: p.maxMarks,
        passingMarks: p.passingMarks,
        marksObtained: r?.marksObtained ?? null,
        isAbsent: r?.isAbsent ?? false,
        passed:
          r && !r.isAbsent && r.marksObtained !== null ? r.marksObtained >= p.passingMarks : null,
      };
    });

    const percentage = totalMax ? Math.round((totalObtained / totalMax) * 10000) / 100 : null;

    return {
      studentId: student.id,
      admissionNo: student.admissionNo,
      fullName: student.user.fullName,
      photoUrl: student.photoUrl,
      className: student.section?.class?.name ?? null,
      sectionName: student.section?.name ?? null,
      schoolName: student.user.school?.name ?? '',
      schoolAddress: student.user.school?.address ?? null,
      branchName: student.user.branch?.name ?? null,
      guardianName: student.guardianName,
      examId: exam.id,
      examName: exam.name,
      subjects,
      totalObtained,
      totalMax,
      percentage,
      grade: calcGrade(percentage),
      overallResult: subjects.some((s) => s.passed === false) ? 'FAIL' : subjects.length ? 'PASS' : null,
    };
  }

  // One-page class result sheet: every student's total/%/grade for an exam.
  async classSummary(examId: string, classId: string, currentUser: CurrentUser) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, deletedAt: null } });
    if (!exam) throw new NotFoundException('Exam not found');
    assertSchoolAccess(currentUser, exam.schoolId);

    const papers = await this.prisma.examSubject.findMany({ where: { examId, classId } });
    if (!papers.length) {
      throw new NotFoundException('No papers found for this exam and class');
    }
    const totalMax = papers.reduce((sum, p) => sum + p.maxMarks, 0);

    const students = await this.prisma.studentProfile.findMany({
      where: { deletedAt: null, section: { classId } },
      include: { user: { select: { fullName: true } } },
      orderBy: { admissionNo: 'asc' },
    });

    const results = await this.prisma.examResult.findMany({
      where: { examSubjectId: { in: papers.map((p) => p.id) } },
    });

    const rows = students.map((s) => {
      const studentResults = results.filter((r) => r.studentId === s.id);
      const totalObtained = studentResults.reduce(
        (sum, r) => sum + (r.isAbsent ? 0 : r.marksObtained ?? 0),
        0,
      );
      const percentage = totalMax ? Math.round((totalObtained / totalMax) * 10000) / 100 : null;
      const anyFail = papers.some((p) => {
        const r = studentResults.find((x) => x.examSubjectId === p.id);
        return !r || r.isAbsent || r.marksObtained === null || r.marksObtained < p.passingMarks;
      });

      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        fullName: s.user.fullName,
        totalObtained,
        totalMax,
        percentage,
        grade: calcGrade(percentage),
        overallResult: anyFail ? 'FAIL' : 'PASS',
      };
    });

    return {
      examId: exam.id,
      examName: exam.name,
      classId,
      totalMax,
      papers: papers.length,
      students: rows.sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)),
    };
  }
}
