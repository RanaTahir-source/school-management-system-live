import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admissions report: new students within a date range ──
  async admissions(
    currentUser: ScopedUser,
    from?: string,
    to?: string,
    schoolId?: string,
    branchId?: string,
    classId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('"from" and "to" query params are required');
    }
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);

    const userFilter: { schoolId?: string; branchId?: string } = {};
    if (scopedSchoolId) userFilter.schoolId = scopedSchoolId;
    if (branchId) userFilter.branchId = branchId;

    const students = await this.prisma.studentProfile.findMany({
      where: {
        deletedAt: null,
        admissionDate: { gte: new Date(from), lte: new Date(to) },
        ...(Object.keys(userFilter).length ? { user: userFilter } : {}),
        ...(classId ? { section: { classId } } : {}),
      },
      include: {
        user: { select: { fullName: true, email: true } },
        section: { include: { class: true } },
      },
      orderBy: { admissionDate: 'asc' },
    });

    const byClass = new Map<string, number>();
    for (const s of students) {
      const name = s.section?.class?.name ?? 'Unassigned';
      byClass.set(name, (byClass.get(name) ?? 0) + 1);
    }

    const rows = students.map((s) => ({
      studentId: s.id,
      admissionNo: s.admissionNo,
      fullName: s.user.fullName,
      email: s.user.email,
      admissionDate: s.admissionDate,
      className: s.section?.class?.name ?? 'Unassigned',
      sectionName: s.section?.name ?? '—',
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
    }));

    return {
      period: { from, to },
      totalAdmissions: rows.length,
      byClass: Array.from(byClass.entries())
        .map(([className, count]) => ({ className, count }))
        .sort((a, b) => b.count - a.count),
      students: rows,
    };
  }

  // ── Student directory export ──
  async studentDirectory(currentUser: ScopedUser, schoolId?: string, classId?: string, sectionId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);

    const students = await this.prisma.studentProfile.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { user: { schoolId: scopedSchoolId } } : {}),
        ...(sectionId ? { sectionId } : classId ? { section: { classId } } : {}),
      },
      include: {
        user: { select: { fullName: true, email: true, phone: true, isActive: true } },
        section: { include: { class: true } },
      },
      orderBy: { admissionNo: 'asc' },
    });

    return students.map((s) => ({
      admissionNo: s.admissionNo,
      fullName: s.user.fullName,
      email: s.user.email,
      phone: s.user.phone,
      className: s.section?.class?.name ?? 'Unassigned',
      sectionName: s.section?.name ?? '—',
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      admissionDate: s.admissionDate,
      status: s.user.isActive ? 'Active' : 'Inactive',
    }));
  }

  // ── Staff directory export ──
  async staffDirectory(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);

    const staff = await this.prisma.staffProfile.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      include: {
        user: { select: { fullName: true, email: true, phone: true, isActive: true } },
      },
      orderBy: { joiningDate: 'asc' },
    });

    return staff.map((s) => ({
      fullName: s.user.fullName,
      email: s.user.email,
      phone: s.phone ?? s.user.phone,
      category: s.category ?? '—',
      designation: s.designation ?? '—',
      joiningDate: s.joiningDate,
      basicPay: s.basicPay,
      status: s.user.isActive ? 'Active' : 'Inactive',
    }));
  }

  // ── Cross-exam performance trend for one class within an academic year ──
  // (the exams module already has a per-exam class summary; this stitches
  // multiple exams together so a Principal/Director can see whether a class
  // is trending up or down over the year.)
  async performanceTrend(currentUser: ScopedUser, classId?: string, academicYearId?: string) {
    if (!classId || !academicYearId) {
      throw new BadRequestException('"classId" and "academicYearId" query params are required');
    }
    const klass = await this.prisma.class.findFirst({ where: { id: classId, deletedAt: null } });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    const exams = await this.prisma.exam.findMany({
      where: { academicYearId, schoolId: klass.schoolId, deletedAt: null },
      orderBy: { startDate: 'asc' },
    });

    const trend = await Promise.all(
      exams.map(async (exam) => {
        const examSubjects = await this.prisma.examSubject.findMany({
          where: { examId: exam.id, classId },
          include: { results: true },
        });

        let obtainedSum = 0;
        let maxSum = 0;
        let papersEvaluated = 0;
        for (const es of examSubjects) {
          for (const r of es.results) {
            if (!r.isAbsent && r.marksObtained != null) {
              obtainedSum += r.marksObtained;
              maxSum += es.maxMarks;
              papersEvaluated++;
            }
          }
        }

        return {
          examId: exam.id,
          examName: exam.name,
          startDate: exam.startDate,
          percentage: maxSum > 0 ? Math.round((obtainedSum / maxSum) * 10000) / 100 : null,
          papersEvaluated,
        };
      }),
    );

    return { classId, className: klass.name, academicYearId, trend };
  }

  // ── Branch-wise summary: students/teachers/classes per branch, for the
  // Chairman/Director dashboard "by campus" breakdown. Unlike most report
  // methods this groups by BRANCH (not just school) since a single school
  // can have several branches (e.g. Jandanwala/Ali Khel/Rodi) and the whole
  // point is to see each one's numbers separately instead of one combined
  // total - GET /reports/branch-summary ──
  async branchSummary(currentUser: ScopedUser) {
    const scopedSchoolId = resolveSchoolScope(currentUser, undefined);

    const branches = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      select: {
        id: true,
        name: true,
        genderScope: true,
        schoolId: true,
        school: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const perBranch = await Promise.all(
      branches.map(async (branch) => {
        const [studentCount, teacherCount, staffCount, classCount] = await Promise.all([
          this.prisma.studentProfile.count({
            where: {
              deletedAt: null,
              status: 'ACTIVE',
              section: { class: { branchId: branch.id } },
            },
          }),
          this.prisma.teacherProfile.count({
            where: { deletedAt: null, isActive: true, user: { branchId: branch.id } },
          }),
          this.prisma.staffProfile.count({
            where: { deletedAt: null, isActive: true, user: { branchId: branch.id } },
          }),
          this.prisma.class.count({
            where: { deletedAt: null, isActive: true, branchId: branch.id },
          }),
        ]);

        return {
          branchId: branch.id,
          branchName: branch.name,
          schoolId: branch.schoolId,
          schoolName: branch.school.name,
          genderScope: branch.genderScope,
          students: studentCount,
          teachers: teacherCount,
          staff: staffCount,
          classes: classCount,
        };
      }),
    );

    const combined = perBranch.reduce(
      (acc, b) => ({
        students: acc.students + b.students,
        teachers: acc.teachers + b.teachers,
        staff: acc.staff + b.staff,
        classes: acc.classes + b.classes,
      }),
      { students: 0, teachers: 0, staff: 0, classes: 0 },
    );

    return { branches: perBranch, combined };
  }
}
