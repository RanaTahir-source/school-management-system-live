import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkHostelAttendanceDto } from './dto/mark-hostel-attendance.dto';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';

const ATTENDANCE_INCLUDE = {
  student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
} as const;

const STAFF_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];

@Injectable()
export class HostelAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(dto: MarkHostelAttendanceDto, currentUser: ScopedUser & { userId: string }) {
    const date = new Date(dto.date);

    // Verify every student up front (and that they belong to the caller's
    // school) before writing anything, so a bad entry doesn't leave a
    // partially-marked day behind.
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: dto.entries.map((e) => e.studentId) }, deletedAt: null },
      include: { user: { select: { schoolId: true } } },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));
    for (const entry of dto.entries) {
      const student = studentMap.get(entry.studentId);
      if (!student) throw new NotFoundException(`Student ${entry.studentId} not found`);
      assertSchoolAccess(currentUser, student.user.schoolId);
    }

    return this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.hostelAttendanceRecord.upsert({
          where: { studentId_date: { studentId: entry.studentId, date } },
          create: {
            studentId: entry.studentId,
            date,
            status: entry.status,
            remarks: entry.remarks,
            markedById: currentUser.userId,
          },
          update: {
            status: entry.status,
            remarks: entry.remarks,
            markedById: currentUser.userId,
          },
        }),
      ),
    );
  }

  async findByDate(currentUser: ScopedUser, date: string, schoolId?: string) {
    const scopedSchoolId = schoolId ?? currentUser.schoolId ?? undefined;
    return this.prisma.hostelAttendanceRecord.findMany({
      where: {
        date: new Date(date),
        ...(scopedSchoolId ? { student: { user: { schoolId: scopedSchoolId } } } : {}),
      },
      include: ATTENDANCE_INCLUDE,
      orderBy: { student: { admissionNo: 'asc' } },
    });
  }

  async findByStudent(studentId: string, currentUser: ScopedUser, from?: string, to?: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: { select: { schoolId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const isStaff = currentUser.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
    if (!isStaff && student.userId !== currentUser.userId) {
      throw new ForbiddenException('You can only view your own hostel attendance');
    }
    if (isStaff) {
      assertSchoolAccess(currentUser, student.user.schoolId);
    }

    return this.prisma.hostelAttendanceRecord.findMany({
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
}
