import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

// ═══════════════════════════════════════════════════════════════════
// PREDICTIVE AI ANALYTICS  (Milestone 14)
//
// Every score below is a deterministic, explainable formula computed
// on-demand from data that already exists (fee invoices, attendance
// records, exam results, timetable assignments) - none of this calls
// an external AI model. Scheduling-style "prediction" problems like
// these (who is likely to default on fees, whose attendance just
// changed, who is at risk of failing) are a much better fit for
// transparent statistical scoring than for an LLM: the numbers are
// auditable, reproducible, and don't depend on the still-unconfigured
// ANTHROPIC_API_KEY. If a school ever wants a narrative write-up on
// top of these numbers, the existing AI Tools module can be pointed
// at this same data once that key is added - the scoring here doesn't
// need to change either way.
// ═══════════════════════════════════════════════════════════════════

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

function riskLevelFor(score: number): RiskLevel {
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function studentLabel(student: {
  admissionNo: string;
  user: { fullName: string };
  section?: { name: string; class?: { name: string } | null } | null;
}) {
  return {
    fullName: student.user.fullName,
    admissionNo: student.admissionNo,
    className: student.section?.class?.name ?? null,
    sectionName: student.section?.name ?? null,
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Every analytics endpoint takes the same "which school" query param and
  // resolves it the same way everywhere else in the app does; unlike a plain
  // list endpoint, an unrestricted CHAIRMAN MUST pick one school here (mixing
  // several schools' fee/attendance/exam data into one report wouldn't mean
  // anything), so this throws instead of silently defaulting to "every school".
  private resolveSchool(currentUser: ScopedUser, requestedSchoolId?: string): string {
    const schoolId = resolveSchoolScope(currentUser, requestedSchoolId ?? null);
    if (!schoolId) {
      throw new BadRequestException('Please specify which school this report is for');
    }
    return schoolId;
  }

  // ─────────────────────────────────────────────
  // 1) FEE DEFAULT PREDICTOR
  // ─────────────────────────────────────────────
  async feeDefaultRisk(currentUser: ScopedUser, requestedSchoolId?: string) {
    const schoolId = this.resolveSchool(currentUser, requestedSchoolId);
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { schoolId, deletedAt: null, dueDate: { gte: sixMonthsAgo } },
      orderBy: [{ studentId: 'asc' }, { period: 'asc' }],
      select: {
        studentId: true,
        period: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        student: {
          select: {
            id: true,
            admissionNo: true,
            status: true,
            user: { select: { fullName: true } },
            section: { select: { name: true, class: { select: { name: true } } } },
          },
        },
      },
    });

    const byStudent = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      if (inv.student.status !== 'ACTIVE') continue; // don't flag students who've already left
      const list = byStudent.get(inv.studentId) ?? [];
      list.push(inv);
      byStudent.set(inv.studentId, list);
    }

    const results: {
      studentId: string;
      fullName: string;
      admissionNo: string;
      className: string | null;
      sectionName: string | null;
      overdueInvoices: number;
      overdueAmount: number;
      consecutiveUnpaidMonths: number;
      riskScore: number;
      riskLevel: RiskLevel;
    }[] = [];

    for (const [studentId, list] of byStudent) {
      const totalBilled = list.reduce((sum, i) => sum + Number(i.totalAmount), 0);
      const overdue = list.filter((i) => i.status !== 'PAID' && new Date(i.dueDate) < today);
      const overdueAmount = overdue.reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidAmount)), 0);

      // Walk newest -> oldest, counting the unbroken run of unpaid/partial
      // invoices right up to now (a single PAID one further back doesn't
      // erase a recent default, so this stops at the first PAID it hits).
      let consecutiveUnpaidMonths = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].status === 'PAID') break;
        consecutiveUnpaidMonths++;
      }

      if (overdue.length === 0 && consecutiveUnpaidMonths === 0) continue; // clean payer, skip

      const lateRatio = overdue.length / list.length;
      const overdueRatio = totalBilled > 0 ? overdueAmount / totalBilled : 0;
      const riskScore = clampScore(lateRatio * 50 + Math.min(30, consecutiveUnpaidMonths * 12) + overdueRatio * 20);

      const student = list[0].student;
      results.push({
        studentId,
        ...studentLabel(student),
        overdueInvoices: overdue.length,
        overdueAmount: Math.round(overdueAmount),
        consecutiveUnpaidMonths,
        riskScore,
        riskLevel: riskLevelFor(riskScore),
      });
    }

    results.sort((a, b) => b.riskScore - a.riskScore);
    return {
      generatedAt: new Date().toISOString(),
      windowMonths: 6,
      studentsFlagged: results.length,
      highRiskCount: results.filter((r) => r.riskLevel === 'HIGH').length,
      mediumRiskCount: results.filter((r) => r.riskLevel === 'MEDIUM').length,
      students: results,
    };
  }

  // ─────────────────────────────────────────────
  // 2) ATTENDANCE ANOMALY ALERTS
  // ─────────────────────────────────────────────
  async attendanceAnomalies(currentUser: ScopedUser, requestedSchoolId?: string) {
    const schoolId = this.resolveSchool(currentUser, requestedSchoolId);
    const today = new Date();
    const baselineStart = new Date(today);
    baselineStart.setDate(baselineStart.getDate() - 90);
    const recentStart = new Date(today);
    recentStart.setDate(recentStart.getDate() - 14);

    const records = await this.prisma.attendanceRecord.findMany({
      where: { date: { gte: baselineStart, lte: today }, section: { class: { schoolId }, deletedAt: null } },
      orderBy: { date: 'asc' },
      select: {
        studentId: true,
        date: true,
        status: true,
        student: {
          select: {
            admissionNo: true,
            status: true,
            user: { select: { fullName: true } },
            section: { select: { name: true, class: { select: { name: true } } } },
          },
        },
      },
    });

    const byStudent = new Map<string, typeof records>();
    for (const r of records) {
      if (r.student.status !== 'ACTIVE') continue;
      const list = byStudent.get(r.studentId) ?? [];
      list.push(r);
      byStudent.set(r.studentId, list);
    }

    const alerts: {
      studentId: string;
      fullName: string;
      admissionNo: string;
      className: string | null;
      sectionName: string | null;
      recentAbsentRatePct: number;
      baselineAbsentRatePct: number;
      consecutiveAbsentDays: number;
      severity: RiskLevel;
      reason: string;
    }[] = [];

    for (const [studentId, list] of byStudent) {
      const recent = list.filter((r) => r.date >= recentStart);
      const baseline = list.filter((r) => r.date < recentStart);
      if (recent.length < 3) continue; // not enough recent data to say anything

      const recentAbsent = recent.filter((r) => r.status === 'ABSENT').length;
      const recentAbsentRate = recentAbsent / recent.length;
      const baselineAbsentRate = baseline.length >= 5 ? baseline.filter((r) => r.status === 'ABSENT').length / baseline.length : null;

      // Longest CURRENT streak of consecutive absent days, counting back from
      // the most recent marked day.
      let consecutiveAbsentDays = 0;
      for (let i = recent.length - 1; i >= 0; i--) {
        if (recent[i].status === 'ABSENT') consecutiveAbsentDays++;
        else break;
      }

      const spike = baselineAbsentRate !== null ? recentAbsentRate - baselineAbsentRate : null;
      const flaggedForStreak = consecutiveAbsentDays >= 3;
      const flaggedForSpike = spike !== null && spike >= 0.25;
      if (!flaggedForStreak && !flaggedForSpike) continue;

      let severity: RiskLevel = 'MEDIUM';
      let reason: string;
      if (consecutiveAbsentDays >= 5) {
        severity = 'HIGH';
        reason = `${consecutiveAbsentDays} consecutive absent days`;
      } else if (spike !== null && spike >= 0.4) {
        severity = 'HIGH';
        reason = `Absence rate jumped from ${Math.round((baselineAbsentRate ?? 0) * 100)}% to ${Math.round(recentAbsentRate * 100)}%`;
      } else if (flaggedForStreak) {
        reason = `${consecutiveAbsentDays} consecutive absent days`;
      } else {
        reason = `Absence rate rose from ${Math.round((baselineAbsentRate ?? 0) * 100)}% to ${Math.round(recentAbsentRate * 100)}%`;
      }

      const student = list[0].student;
      alerts.push({
        studentId,
        ...studentLabel(student),
        recentAbsentRatePct: Math.round(recentAbsentRate * 100),
        baselineAbsentRatePct: baselineAbsentRate !== null ? Math.round(baselineAbsentRate * 100) : 0,
        consecutiveAbsentDays,
        severity,
        reason,
      });
    }

    alerts.sort((a, b) => (b.severity === a.severity ? b.consecutiveAbsentDays - a.consecutiveAbsentDays : b.severity === 'HIGH' ? 1 : -1));
    return {
      generatedAt: new Date().toISOString(),
      windowDays: { recent: 14, baseline: 90 },
      alertsCount: alerts.length,
      alerts,
    };
  }

  // ─────────────────────────────────────────────
  // 3) EXAM RISK SCORING
  // ─────────────────────────────────────────────
  async examRiskScoring(currentUser: ScopedUser, requestedSchoolId?: string) {
    const schoolId = this.resolveSchool(currentUser, requestedSchoolId);

    const recentExams = await this.prisma.exam.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      take: 2,
      select: { id: true, name: true, startDate: true },
    });
    if (recentExams.length === 0) {
      return { generatedAt: new Date().toISOString(), latestExam: null, studentsFlagged: 0, students: [] };
    }
    const [latestExam, previousExam] = recentExams;

    const loadPctByStudent = async (examId: string) => {
      const rows = await this.prisma.examResult.findMany({
        where: { examSubject: { examId } },
        select: {
          studentId: true,
          marksObtained: true,
          isAbsent: true,
          examSubject: { select: { maxMarks: true, passingMarks: true } },
        },
      });
      const byStudent = new Map<string, { obtained: number; max: number; failed: number; absent: number }>();
      for (const r of rows) {
        const bucket = byStudent.get(r.studentId) ?? { obtained: 0, max: 0, failed: 0, absent: 0 };
        if (r.isAbsent) {
          bucket.absent++;
        } else {
          bucket.obtained += r.marksObtained ?? 0;
          bucket.max += r.examSubject.maxMarks;
          if ((r.marksObtained ?? 0) < r.examSubject.passingMarks) bucket.failed++;
        }
        byStudent.set(r.studentId, bucket);
      }
      return byStudent;
    };

    const latestByStudent = await loadPctByStudent(latestExam.id);
    const previousByStudent = previousExam ? await loadPctByStudent(previousExam.id) : new Map();

    const studentIds = Array.from(latestByStudent.keys());
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentIds }, status: 'ACTIVE' },
      select: {
        id: true,
        admissionNo: true,
        user: { select: { fullName: true } },
        section: { select: { name: true, class: { select: { name: true } } } },
      },
    });
    const studentInfo = new Map(students.map((s) => [s.id, s]));

    const results: {
      studentId: string;
      fullName: string;
      admissionNo: string;
      className: string | null;
      sectionName: string | null;
      latestScorePct: number;
      previousScorePct: number | null;
      failedSubjects: number;
      absentPapers: number;
      riskScore: number;
      riskLevel: RiskLevel;
    }[] = [];

    for (const [studentId, bucket] of latestByStudent) {
      const info = studentInfo.get(studentId);
      if (!info) continue; // left the school, or no longer active
      if (bucket.max === 0) continue; // absent from every paper - nothing to score

      const latestPct = (bucket.obtained / bucket.max) * 100;
      const prevBucket = previousByStudent.get(studentId);
      const previousPct = prevBucket && prevBucket.max > 0 ? (prevBucket.obtained / prevBucket.max) * 100 : null;
      const decline = previousPct !== null ? Math.max(0, previousPct - latestPct) : 0;

      const riskScore = clampScore(Math.max(0, 100 - latestPct) * 0.6 + bucket.failed * 8 + decline * 0.8 + bucket.absent * 6);
      if (riskScore < 20) continue; // comfortably fine, don't clutter the list

      results.push({
        studentId,
        ...studentLabel(info),
        latestScorePct: Math.round(latestPct),
        previousScorePct: previousPct !== null ? Math.round(previousPct) : null,
        failedSubjects: bucket.failed,
        absentPapers: bucket.absent,
        riskScore,
        riskLevel: riskLevelFor(riskScore),
      });
    }

    results.sort((a, b) => b.riskScore - a.riskScore);
    return {
      generatedAt: new Date().toISOString(),
      latestExam: { id: latestExam.id, name: latestExam.name },
      previousExam: previousExam ? { id: previousExam.id, name: previousExam.name } : null,
      studentsFlagged: results.length,
      students: results,
    };
  }

  // ─────────────────────────────────────────────
  // 4) TEACHER EFFICIENCY ANALYTICS
  // ─────────────────────────────────────────────
  // A support/coaching signal, not a punitive score - it combines how their
  // students did on the most recent exam with (for class teachers) how
  // consistently they mark daily attendance. Framed to managers as "who
  // might need a check-in or extra resources", not a ranking to punish by.
  async teacherEfficiency(currentUser: ScopedUser, requestedSchoolId?: string) {
    const schoolId = this.resolveSchool(currentUser, requestedSchoolId);

    const latestExam = await this.prisma.exam.findFirst({
      where: { schoolId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true },
    });

    const slots = await this.prisma.timetableSlot.findMany({
      where: { teacherId: { not: null }, section: { class: { schoolId }, deletedAt: null } },
      select: {
        teacherId: true,
        sectionId: true,
        subjectId: true,
        section: { select: { classId: true } },
      },
    });

    type Assignment = { sectionId: string; subjectId: string; classId: string };
    const byTeacher = new Map<string, Assignment[]>();
    for (const s of slots) {
      if (!s.teacherId) continue;
      const key = `${s.sectionId}-${s.subjectId}`;
      const list = byTeacher.get(s.teacherId) ?? [];
      if (!list.some((a) => `${a.sectionId}-${a.subjectId}` === key)) {
        list.push({ sectionId: s.sectionId, subjectId: s.subjectId, classId: s.section.classId });
      }
      byTeacher.set(s.teacherId, list);
    }

    const teacherIds = Array.from(byTeacher.keys());
    if (teacherIds.length === 0) {
      return { generatedAt: new Date().toISOString(), latestExam: latestExam?.name ?? null, teachers: [] };
    }

    const teacherUsers = await this.prisma.user.findMany({
      where: { id: { in: teacherIds }, deletedAt: null },
      select: { id: true, fullName: true, teacherProfile: { select: { employeeId: true } } },
    });

    const classTeacherSections = await this.prisma.section.findMany({
      where: { classTeacherId: { in: teacherIds }, class: { schoolId }, deletedAt: null },
      select: { id: true, name: true, class: { select: { name: true } }, classTeacherId: true, students: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const attendanceMarkedByTeacher = await this.prisma.attendanceRecord.groupBy({
      by: ['markedById', 'date'],
      where: { markedById: { in: teacherIds }, date: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    });
    const markedDaysByTeacher = new Map<string, Set<string>>();
    for (const row of attendanceMarkedByTeacher) {
      const set = markedDaysByTeacher.get(row.markedById) ?? new Set<string>();
      set.add(row.date.toISOString().slice(0, 10));
      markedDaysByTeacher.set(row.markedById, set);
    }
    // A school-wide "how many distinct days had attendance marked at all in
    // the last 30" acts as the expected-days denominator, so this doesn't
    // unfairly punish a teacher for weekends/holidays no one marked either.
    const schoolWideMarkedDays = new Set<string>();
    for (const set of markedDaysByTeacher.values()) {
      for (const d of set) schoolWideMarkedDays.add(d);
    }
    const expectedDays = Math.max(1, schoolWideMarkedDays.size);

    const results = await Promise.all(
      teacherIds.map(async (teacherId) => {
        const user = teacherUsers.find((u) => u.id === teacherId);
        const assignments = byTeacher.get(teacherId) ?? [];

        let totalObtained = 0;
        let totalMax = 0;
        let totalFailed = 0;
        let totalPapers = 0;

        if (latestExam) {
          for (const a of assignments) {
            const examSubject = await this.prisma.examSubject.findUnique({
              where: { examId_classId_subjectId: { examId: latestExam.id, classId: a.classId, subjectId: a.subjectId } },
              select: { id: true, maxMarks: true, passingMarks: true },
            });
            if (!examSubject) continue;
            const section = await this.prisma.section.findUnique({
              where: { id: a.sectionId },
              select: { students: { where: { status: 'ACTIVE' }, select: { id: true } } },
            });
            const studentIds = section?.students.map((s) => s.id) ?? [];
            if (studentIds.length === 0) continue;
            const examResults = await this.prisma.examResult.findMany({
              where: { examSubjectId: examSubject.id, studentId: { in: studentIds } },
              select: { marksObtained: true, isAbsent: true },
            });
            for (const r of examResults) {
              if (r.isAbsent) continue;
              totalObtained += r.marksObtained ?? 0;
              totalMax += examSubject.maxMarks;
              totalPapers++;
              if ((r.marksObtained ?? 0) < examSubject.passingMarks) totalFailed++;
            }
          }
        }

        const avgScorePct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
        const passRatePct = totalPapers > 0 ? Math.round(((totalPapers - totalFailed) / totalPapers) * 100) : null;

        const classTeacherOf = classTeacherSections.find((s) => s.classTeacherId === teacherId);
        const attendanceMarkingRatePct = classTeacherOf
          ? Math.round(((markedDaysByTeacher.get(teacherId)?.size ?? 0) / expectedDays) * 100)
          : null;

        const scoreParts: number[] = [];
        if (passRatePct !== null) scoreParts.push(passRatePct);
        if (attendanceMarkingRatePct !== null) scoreParts.push(attendanceMarkingRatePct);
        const efficiencyScore = scoreParts.length ? Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) : null;

        return {
          teacherId,
          fullName: user?.fullName ?? 'Unknown',
          employeeId: user?.teacherProfile?.employeeId ?? null,
          subjectsTaught: new Set(assignments.map((a) => a.subjectId)).size,
          sectionsTaught: new Set(assignments.map((a) => a.sectionId)).size,
          avgScorePct,
          passRatePct,
          classTeacherOf: classTeacherOf ? `${classTeacherOf.class.name} - ${classTeacherOf.name}` : null,
          attendanceMarkingRatePct,
          efficiencyScore,
        };
      }),
    );

    results.sort((a, b) => (a.efficiencyScore ?? 100) - (b.efficiencyScore ?? 100));
    return {
      generatedAt: new Date().toISOString(),
      latestExam: latestExam?.name ?? null,
      note: 'A coaching signal, not a ranking - lower scores mean a check-in may help, not that someone is failing.',
      teachers: results,
    };
  }

  // ─────────────────────────────────────────────
  // 5) AUTO LEARNING REPORT (one student)
  // ─────────────────────────────────────────────
  async learningReport(currentUser: ScopedUser, studentId: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      select: {
        id: true,
        admissionNo: true,
        user: { select: { id: true, fullName: true, schoolId: true } },
        section: { select: { name: true, class: { select: { name: true } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.assertCanViewStudent(currentUser, student);

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [attendanceRows, exams, invoices] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId, date: { gte: thirtyDaysAgo, lte: today } },
        select: { status: true },
      }),
      this.prisma.examResult.findMany({
        where: { studentId },
        select: {
          marksObtained: true,
          isAbsent: true,
          examSubject: {
            select: { maxMarks: true, passingMarks: true, subject: { select: { name: true } }, exam: { select: { id: true, name: true, startDate: true } } },
          },
        },
      }),
      this.prisma.feeInvoice.findMany({
        where: { studentId, deletedAt: null },
        orderBy: { period: 'desc' },
        take: 6,
        select: { period: true, totalAmount: true, paidAmount: true, status: true, dueDate: true },
      }),
    ]);

    const presentCount = attendanceRows.filter((r) => r.status === 'PRESENT').length;
    const absentCount = attendanceRows.filter((r) => r.status === 'ABSENT').length;
    const lateCount = attendanceRows.filter((r) => r.status === 'LATE').length;
    const leaveCount = attendanceRows.filter((r) => r.status === 'LEAVE').length;
    const attendanceTotal = attendanceRows.length;
    const attendanceRatePct = attendanceTotal > 0 ? Math.round(((presentCount + lateCount) / attendanceTotal) * 100) : null;

    const examMap = new Map<string, { name: string; startDate: Date; obtained: number; max: number; failed: number; bySubject: { name: string; pct: number }[] }>();
    for (const r of exams) {
      const exam = r.examSubject.exam;
      const bucket =
        examMap.get(exam.id) ??
        ({ name: exam.name, startDate: exam.startDate, obtained: 0, max: 0, failed: 0, bySubject: [] } as {
          name: string;
          startDate: Date;
          obtained: number;
          max: number;
          failed: number;
          bySubject: { name: string; pct: number }[];
        });
      if (!r.isAbsent) {
        bucket.obtained += r.marksObtained ?? 0;
        bucket.max += r.examSubject.maxMarks;
        if ((r.marksObtained ?? 0) < r.examSubject.passingMarks) bucket.failed++;
        bucket.bySubject.push({ name: r.examSubject.subject.name, pct: Math.round(((r.marksObtained ?? 0) / r.examSubject.maxMarks) * 100) });
      }
      examMap.set(exam.id, bucket);
    }
    const examTrend = Array.from(examMap.values())
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((e) => ({
        examName: e.name,
        scorePct: e.max > 0 ? Math.round((e.obtained / e.max) * 100) : null,
        failedSubjects: e.failed,
        subjects: e.bySubject,
      }));

    const totalDue = invoices.reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    const overdueInvoices = invoices.filter((i) => i.status !== 'PAID' && new Date(i.dueDate) < today);

    // A short, templated write-up stitched from the numbers above - not an
    // LLM call, just plain-language sentences so this is useful to a parent
    // without them having to read the raw stats.
    const summarySentences: string[] = [];
    if (examTrend.length > 0) {
      const latest = examTrend[examTrend.length - 1];
      const previous = examTrend.length > 1 ? examTrend[examTrend.length - 2] : null;
      if (latest.scorePct !== null) {
        let line = `In the most recent exam (${latest.examName}), ${student.user.fullName} scored ${latest.scorePct}%`;
        if (previous?.scorePct !== null && previous) {
          const diff = latest.scorePct - previous.scorePct;
          line += diff > 0 ? `, up ${diff} points from ${previous.examName}.` : diff < 0 ? `, down ${Math.abs(diff)} points from ${previous.examName}.` : `, unchanged from ${previous.examName}.`;
        } else {
          line += '.';
        }
        summarySentences.push(line);
      }
      if (latest.failedSubjects > 0) {
        summarySentences.push(`${latest.failedSubjects} subject(s) were below the passing mark in that exam.`);
      }
    } else {
      summarySentences.push('No exam results are on record yet.');
    }
    if (attendanceRatePct !== null) {
      summarySentences.push(`Attendance over the last 30 days was ${attendanceRatePct}% (${absentCount} absence(s), ${lateCount} late arrival(s)).`);
    } else {
      summarySentences.push('No attendance has been marked in the last 30 days.');
    }
    if (totalDue > 0) {
      summarySentences.push(
        overdueInvoices.length > 0
          ? `Fee dues of Rs. ${Math.round(totalDue).toLocaleString()} are outstanding, including ${overdueInvoices.length} overdue invoice(s).`
          : `Fee dues of Rs. ${Math.round(totalDue).toLocaleString()} are pending but not yet overdue.`,
      );
    } else {
      summarySentences.push('Fees are fully paid.');
    }

    return {
      generatedAt: new Date().toISOString(),
      student: {
        id: student.id,
        fullName: student.user.fullName,
        admissionNo: student.admissionNo,
        className: student.section?.class?.name ?? null,
        sectionName: student.section?.name ?? null,
      },
      attendance: { windowDays: 30, presentCount, absentCount, lateCount, leaveCount, attendanceRatePct },
      examTrend,
      feeStatus: { totalDueRecentPeriods: Math.round(totalDue), overdueInvoices: overdueInvoices.length },
      summary: summarySentences.join(' '),
    };
  }

  // A STUDENT may only fetch their own report; a PARENT only a linked
  // child's; everyone else needs ordinary same-school staff access.
  private async assertCanViewStudent(
    currentUser: ScopedUser,
    student: { user: { id: string; schoolId: string | null } },
  ) {
    if (currentUser.roles.includes('STUDENT')) {
      if (currentUser.userId !== student.user.id) {
        throw new ForbiddenException('You can only view your own learning report');
      }
      return;
    }
    if (currentUser.roles.includes('PARENT')) {
      const link = await this.prisma.parentStudent.findFirst({
        where: { parentId: currentUser.userId, student: { userId: student.user.id } },
      });
      if (!link) throw new ForbiddenException("You can only view your own child's learning report");
      return;
    }
    assertSchoolAccess(currentUser, student.user.schoolId);
  }

  // Resolves the caller's own studentId for the "mine" learning-report route.
  async myLearningReport(currentUser: ScopedUser) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: currentUser.userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('No student profile linked to this account');
    return this.learningReport(currentUser, profile.id);
  }
}
