import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';
import { CommunicationProviderService } from '../communication/communication-provider.service';

type CurrentUser = { userId: string; roles: string[]; schoolId?: string | null };

const STAFF_OVERRIDE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];
const STAFF_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER'];

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationProviderService,
  ) {}

  async mark(dto: MarkAttendanceDto, currentUser: CurrentUser) {
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, deletedAt: null },
      include: { class: { select: { schoolId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    // A plain TEACHER may only mark attendance for a section they are the
    // class teacher of. DIRECTOR/ADMIN/PRINCIPAL can mark any section.
    const isStaffOverride = currentUser.roles.some((r) => STAFF_OVERRIDE_ROLES.includes(r));
    if (!isStaffOverride && section.classTeacherId !== currentUser.userId) {
      throw new ForbiddenException('You are not the class teacher for this section');
    }

    const studentIds = dto.entries.map((e) => e.studentId);
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: { id: true, sectionId: true },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const missing = studentIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(`Unknown student id(s): ${missing.join(', ')}`);
    }

    const wrongSection = students.filter((s) => s.sectionId !== dto.sectionId);
    if (wrongSection.length) {
      throw new BadRequestException(
        `These students are not enrolled in section ${dto.sectionId}: ${wrongSection
          .map((s) => s.id)
          .join(', ')}`,
      );
    }

    const date = new Date(dto.date);

    const results = await this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: entry.studentId, date } },
          update: {
            status: entry.status,
            remarks: entry.remarks,
            sectionId: dto.sectionId,
            markedById: currentUser.userId,
          },
          create: {
            studentId: entry.studentId,
            sectionId: dto.sectionId,
            date,
            status: entry.status,
            remarks: entry.remarks,
            markedById: currentUser.userId,
          },
        }),
      ),
    );

    // Fire-and-forget: an SMS failure (or missing provider credentials -
    // CommunicationProviderService just logs+records until one is wired up)
    // should never fail the attendance marking itself.
    this.notifyAbsentees(dto.entries, section.class.schoolId, date).catch((err) =>
      this.logger.warn(`Absence notifications failed: ${(err as Error).message}`),
    );

    return results;
  }

  // Texts the linked parent (falling back to the legacy guardianPhone field)
  // for every student marked ABSENT in this batch. Present/Late/Leave don't
  // trigger a message - only absence, matching how school SMS systems work.
  private async notifyAbsentees(entries: MarkAttendanceDto['entries'], schoolId: string, date: Date) {
    const absentIds = entries.filter((e) => e.status === 'ABSENT').map((e) => e.studentId);
    if (!absentIds.length) return;

    const [school, students] = await Promise.all([
      this.prisma.school.findFirst({ where: { id: schoolId }, select: { name: true } }),
      this.prisma.studentProfile.findMany({
        where: { id: { in: absentIds } },
        select: {
          id: true,
          guardianPhone: true,
          user: { select: { fullName: true } },
          parentLinks: { select: { parent: { select: { phone: true } } } },
        },
      }),
    ]);

    const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const schoolName = school?.name ?? 'School';

    await Promise.all(
      students.map((s) => {
        const parentPhone = s.parentLinks.find((link) => link.parent.phone)?.parent.phone;
        const phone = parentPhone ?? s.guardianPhone;
        if (!phone) return null;

        const body = `${schoolName}: ${s.user.fullName} was marked ABSENT today (${dateLabel}). Please contact the school office if this is incorrect.`;
        return this.communication.sendSms(phone, body, schoolId);
      }),
    );
  }

  // Full section roster for a given day, with each student's status
  // (null if nobody has marked them yet) - the "mark sheet" view.
  async findBySection(sectionId: string, date: string, currentUser: CurrentUser) {
    if (!sectionId || !date) {
      throw new BadRequestException('Both "sectionId" and "date" query params are required');
    }

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      include: { class: { select: { schoolId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    const day = new Date(date);

    const [students, records] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where: { sectionId, deletedAt: null },
        include: { user: { select: { fullName: true } } },
        orderBy: { admissionNo: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({ where: { sectionId, date: day } }),
    ]);

    const byStudent = new Map(records.map((r) => [r.studentId, r]));

    return students.map((s) => {
      const record = byStudent.get(s.id);
      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        fullName: s.user.fullName,
        status: record?.status ?? null,
        remarks: record?.remarks ?? null,
        recordId: record?.id ?? null,
      };
    });
  }

  async findByStudent(studentId: string, currentUser: CurrentUser, from?: string, to?: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true, userId: true, user: { select: { schoolId: true } } },
    });
    if (!profile) throw new NotFoundException('Student not found');

    const isStaff = currentUser.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
    if (!isStaff && profile.userId !== currentUser.userId) {
      throw new ForbiddenException('You can only view your own attendance');
    }
    if (isStaff) {
      assertSchoolAccess(currentUser, profile.user.schoolId);
    }

    return this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  // Whole-school snapshot for one day: total/boys/girls strength, present/absent/
  // late/leave counts, and a per-class/section breakdown table - the "daily
  // attendance register" a Director/Principal would want on one page.
  async schoolReport(schoolId: string, date: string, currentUser: ScopedUser) {
    if (!schoolId || !date) {
      throw new BadRequestException('Both "schoolId" and "date" query params are required');
    }
    assertSchoolAccess(currentUser, schoolId);

    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const day = new Date(date);

    const students = await this.prisma.studentProfile.findMany({
      where: { deletedAt: null, isActive: true, user: { schoolId, deletedAt: null } },
      select: {
        id: true,
        gender: true,
        section: {
          select: { name: true, class: { select: { name: true, order: true } } },
        },
      },
    });

    const studentIds = students.map((s) => s.id);

    const records = studentIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: { studentId: { in: studentIds }, date: day },
          select: { studentId: true, status: true },
        })
      : [];

    const statusByStudent = new Map(records.map((r) => [r.studentId, r.status]));

    const totalBoys = students.filter((s) => s.gender === 'MALE').length;
    const totalGirls = students.filter((s) => s.gender === 'FEMALE').length;
    const totalUnspecified = students.length - totalBoys - totalGirls;

    const overall = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const status of statusByStudent.values()) {
      if (status === 'PRESENT') overall.present++;
      else if (status === 'ABSENT') overall.absent++;
      else if (status === 'LATE') overall.late++;
      else if (status === 'LEAVE') overall.leave++;
    }

    const marked = records.length;
    const unmarked = students.length - marked;
    const presentEquivalent = overall.present + overall.late;

    // Group into a per-class/section table for the printable breakdown.
    type ClassRow = {
      className: string;
      sectionName: string;
      order: number;
      strength: number;
      boys: number;
      girls: number;
      present: number;
      absent: number;
      late: number;
      leave: number;
    };
    const groups = new Map<string, ClassRow>();

    for (const s of students) {
      const className = s.section?.class?.name ?? 'Unassigned';
      const sectionName = s.section?.name ?? '-';
      const key = `${className}::${sectionName}`;

      if (!groups.has(key)) {
        groups.set(key, {
          className,
          sectionName,
          order: s.section?.class?.order ?? 999,
          strength: 0,
          boys: 0,
          girls: 0,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
        });
      }
      const row = groups.get(key)!;
      row.strength++;
      if (s.gender === 'MALE') row.boys++;
      if (s.gender === 'FEMALE') row.girls++;

      const status = statusByStudent.get(s.id);
      if (status === 'PRESENT') row.present++;
      else if (status === 'ABSENT') row.absent++;
      else if (status === 'LATE') row.late++;
      else if (status === 'LEAVE') row.leave++;
    }

    const byClass = Array.from(groups.values()).sort(
      (a, b) => a.order - b.order || a.sectionName.localeCompare(b.sectionName),
    );

    return {
      schoolId: school.id,
      schoolName: school.name,
      date,
      strength: {
        total: students.length,
        boys: totalBoys,
        girls: totalGirls,
        unspecified: totalUnspecified,
      },
      attendance: {
        present: overall.present,
        absent: overall.absent,
        late: overall.late,
        leave: overall.leave,
        unmarked,
      },
      attendancePct: marked ? Math.round((presentEquivalent / marked) * 100) : null,
      byClass,
    };
  }

  // Per-student present/absent/late/leave counts + attendance % over a date range.
  async summary(sectionId: string, from: string, to: string, currentUser: CurrentUser) {
    if (!sectionId || !from || !to) {
      throw new BadRequestException('"sectionId", "from" and "to" query params are required');
    }

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      include: { class: { select: { schoolId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    const [students, records] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where: { sectionId, deletedAt: null },
        include: { user: { select: { fullName: true } } },
        orderBy: { admissionNo: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { sectionId, date: { gte: new Date(from), lte: new Date(to) } },
      }),
    ]);

    return students.map((s) => {
      const studentRecords = records.filter((r) => r.studentId === s.id);
      const total = studentRecords.length;
      const present = studentRecords.filter(
        (r) => r.status === 'PRESENT' || r.status === 'LATE',
      ).length;

      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        fullName: s.user.fullName,
        totalMarked: total,
        present,
        absent: studentRecords.filter((r) => r.status === 'ABSENT').length,
        late: studentRecords.filter((r) => r.status === 'LATE').length,
        leave: studentRecords.filter((r) => r.status === 'LEAVE').length,
        attendancePct: total ? Math.round((present / total) * 100) : null,
      };
    });
  }

  // Classic month-view attendance register for a section: every student as a
  // row, every calendar day as a column, with per-student monthly totals -
  // the printable equivalent of the paper attendance register.
  async register(sectionId: string, year: number, month: number, currentUser: CurrentUser) {
    if (!sectionId || !year || !month) {
      throw new BadRequestException('"sectionId", "year" and "month" query params are required');
    }

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      include: {
        class: {
          include: {
            school: { select: { name: true, address: true } },
            branch: { select: { name: true } },
          },
        },
        classTeacher: { select: { fullName: true } },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month - 1, daysInMonth));

    const [students, records] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where: { sectionId, deletedAt: null },
        include: { user: { select: { fullName: true } } },
        orderBy: { admissionNo: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { sectionId, date: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    const byStudentDay = new Map<string, Map<number, string>>();
    for (const r of records) {
      const day = r.date.getUTCDate();
      if (!byStudentDay.has(r.studentId)) byStudentDay.set(r.studentId, new Map());
      byStudentDay.get(r.studentId)!.set(day, r.status);
    }

    const students_ = students.map((s) => {
      const dayMap = byStudentDay.get(s.id) ?? new Map<number, string>();
      const marks: (string | null)[] = [];
      let present = 0;
      let absent = 0;
      let late = 0;
      let leave = 0;
      let marked = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const status = dayMap.get(d) ?? null;
        marks.push(status);
        if (status) {
          marked++;
          if (status === 'ABSENT') absent++;
          else if (status === 'LEAVE') leave++;
          else {
            present++;
            if (status === 'LATE') late++;
          }
        }
      }
      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        fullName: s.user.fullName,
        marks,
        present,
        absent,
        late,
        leave,
        marked,
        attendancePct: marked ? Math.round((present / marked) * 100) : null,
      };
    });

    return {
      sectionId: section.id,
      className: section.class.name,
      sectionName: section.name,
      schoolName: section.class.school.name,
      schoolAddress: section.class.school.address,
      branchName: section.class.branch.name,
      classTeacherName: section.classTeacher?.fullName ?? null,
      year,
      month,
      daysInMonth,
      students: students_,
    };
  }
}
