import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
import { GenerateTimetableDto } from './dto/generate-timetable.dto';
import { assertSchoolAccess } from '../../common/utils/school-scope';

type CurrentUser = { userId: string; roles: string[]; schoolId?: string | null };

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadSectionOrThrow(sectionId: string) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      include: { class: { select: { schoolId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  // A teacher can't be in two sections during the same period on the same
  // day. excludeId is passed on update so a slot doesn't conflict with itself.
  private async assertNoTeacherConflict(
    teacherId: string,
    dayOfWeek: number,
    periodNo: number,
    excludeId?: string,
  ) {
    const clash = await this.prisma.timetableSlot.findFirst({
      where: {
        teacherId,
        dayOfWeek,
        periodNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { section: { include: { class: true } } },
    });
    if (clash) {
      throw new BadRequestException(
        `This teacher is already scheduled for ${clash.section.class.name} - ${clash.section.name} ` +
          `on ${DAY_NAMES[dayOfWeek]}, period ${periodNo}`,
      );
    }
  }

  async create(dto: CreateTimetableSlotDto, currentUser: CurrentUser) {
    const section = await this.loadSectionOrThrow(dto.sectionId);
    assertSchoolAccess(currentUser, section.class.schoolId);

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, schoolId: section.class.schoolId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found in this school');

    if (dto.teacherId) {
      const teacher = await this.prisma.user.findFirst({
        where: { id: dto.teacherId, schoolId: section.class.schoolId, deletedAt: null },
      });
      if (!teacher) throw new NotFoundException('Teacher not found in this school');
      await this.assertNoTeacherConflict(dto.teacherId, dto.dayOfWeek, dto.periodNo);
    }

    try {
      return await this.prisma.timetableSlot.create({
        data: {
          sectionId: dto.sectionId,
          subjectId: dto.subjectId,
          teacherId: dto.teacherId,
          dayOfWeek: dto.dayOfWeek,
          periodNo: dto.periodNo,
          startTime: dto.startTime,
          endTime: dto.endTime,
          room: dto.room,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException(
          `This section already has a subject scheduled for ${DAY_NAMES[dto.dayOfWeek]}, period ${dto.periodNo}`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateTimetableSlotDto, currentUser: CurrentUser) {
    const existing = await this.prisma.timetableSlot.findFirst({
      where: { id },
      include: { section: { include: { class: { select: { schoolId: true } } } } },
    });
    if (!existing) throw new NotFoundException('Timetable slot not found');
    assertSchoolAccess(currentUser, existing.section.class.schoolId);

    const teacherId = dto.teacherId !== undefined ? dto.teacherId : existing.teacherId;
    const dayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const periodNo = dto.periodNo ?? existing.periodNo;

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, schoolId: existing.section.class.schoolId, deletedAt: null },
      });
      if (!subject) throw new NotFoundException('Subject not found in this school');
    }

    if (teacherId && (dto.teacherId !== undefined || dto.dayOfWeek !== undefined || dto.periodNo !== undefined)) {
      const teacher = await this.prisma.user.findFirst({
        where: { id: teacherId, schoolId: existing.section.class.schoolId, deletedAt: null },
      });
      if (!teacher) throw new NotFoundException('Teacher not found in this school');
      await this.assertNoTeacherConflict(teacherId, dayOfWeek, periodNo, id);
    }

    try {
      return await this.prisma.timetableSlot.update({
        where: { id },
        data: {
          subjectId: dto.subjectId,
          teacherId: dto.teacherId !== undefined ? dto.teacherId : undefined,
          dayOfWeek: dto.dayOfWeek,
          periodNo: dto.periodNo,
          startTime: dto.startTime,
          endTime: dto.endTime,
          room: dto.room,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException(
          `This section already has a subject scheduled for ${DAY_NAMES[dayOfWeek]}, period ${periodNo}`,
        );
      }
      throw err;
    }
  }

  async remove(id: string, currentUser: CurrentUser) {
    const existing = await this.prisma.timetableSlot.findFirst({
      where: { id },
      include: { section: { include: { class: { select: { schoolId: true } } } } },
    });
    if (!existing) throw new NotFoundException('Timetable slot not found');
    assertSchoolAccess(currentUser, existing.section.class.schoolId);

    await this.prisma.timetableSlot.delete({ where: { id } });
    return { message: 'Timetable slot removed' };
  }

  // Full weekly grid for one section, ordered for direct rendering.
  async findBySection(sectionId: string, currentUser: CurrentUser) {
    const section = await this.loadSectionOrThrow(sectionId);
    assertSchoolAccess(currentUser, section.class.schoolId);

    return this.prisma.timetableSlot.findMany({
      where: { sectionId },
      include: {
        subject: { select: { name: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
    });
  }

  // A teacher's own weekly schedule across every section they teach.
  async findByTeacher(teacherId: string, currentUser: CurrentUser) {
    const teacher = await this.prisma.user.findFirst({ where: { id: teacherId, deletedAt: null } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const isSelf = currentUser.userId === teacherId;
    if (!isSelf) {
      assertSchoolAccess(currentUser, teacher.schoolId);
    }

    return this.prisma.timetableSlot.findMany({
      where: { teacherId },
      include: {
        subject: { select: { name: true } },
        section: { select: { name: true, class: { select: { name: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
    });
  }

  // "My schedule": resolves the caller's own section (STUDENT) or their own
  // teaching slots (TEACHER) without the caller needing to know any IDs.
  async findMine(currentUser: CurrentUser) {
    if (currentUser.roles.includes('STUDENT')) {
      const profile = await this.prisma.studentProfile.findFirst({
        where: { userId: currentUser.userId, deletedAt: null },
      });
      if (!profile?.sectionId) return [];
      return this.findBySection(profile.sectionId, currentUser);
    }

    if (currentUser.roles.includes('TEACHER')) {
      return this.findByTeacher(currentUser.userId, currentUser);
    }

    throw new ForbiddenException('No personal timetable for this role - use the section or teacher views instead');
  }

  // Auto-fills a section's weekly grid from a list of subject requirements
  // (periods/week, optionally pinned to a teacher). This is a deterministic
  // constraint-based placement, not an AI call - scheduling is a pure
  // combinatorial fit problem, so a greedy round-robin placer that respects
  // teacher conflicts school-wide gives a reliable, explainable result
  // without depending on any external AI service.
  //
  // Default behaviour only fills currently-EMPTY (day, period) cells for the
  // section, so anything entered by hand via the manual Add Period flow is
  // left untouched. Passing replaceExisting wipes the section's slots first
  // and generates on a clean grid instead.
  async generate(dto: GenerateTimetableDto, currentUser: CurrentUser) {
    const section = await this.loadSectionOrThrow(dto.sectionId);
    const schoolId = section.class.schoolId;
    assertSchoolAccess(currentUser, schoolId);

    const days = Array.from(new Set(dto.workingDays))
      .filter((d) => d >= 1 && d <= 7)
      .sort((a, b) => a - b);
    if (days.length === 0) {
      throw new BadRequestException('At least one working day (1=Monday..7=Sunday) is required');
    }

    const subjectIds = dto.subjects.map((s) => s.subjectId);
    const subjectsInSchool = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, schoolId, deletedAt: null },
    });
    const subjectMap = new Map(subjectsInSchool.map((s) => [s.id, s]));
    for (const req of dto.subjects) {
      if (!subjectMap.has(req.subjectId)) {
        throw new NotFoundException(`Subject ${req.subjectId} not found in this school`);
      }
    }

    const teacherIds = Array.from(
      new Set(dto.subjects.map((s) => s.teacherId).filter((t): t is string => !!t)),
    );
    if (teacherIds.length) {
      const teachersInSchool = await this.prisma.user.findMany({
        where: { id: { in: teacherIds }, schoolId, deletedAt: null },
      });
      const teacherIdSet = new Set(teachersInSchool.map((t) => t.id));
      for (const id of teacherIds) {
        if (!teacherIdSet.has(id)) throw new NotFoundException(`Teacher ${id} not found in this school`);
      }
    }

    if (dto.replaceExisting) {
      await this.prisma.timetableSlot.deleteMany({ where: { sectionId: dto.sectionId } });
    }

    // Cells this section has class in, and which of them are already filled
    // (only relevant when NOT replacing - those are left untouched).
    const cells: { dayOfWeek: number; periodNo: number }[] = [];
    for (const day of days) {
      for (let period = 1; period <= dto.periodsPerDay; period++) {
        cells.push({ dayOfWeek: day, periodNo: period });
      }
    }
    const existingSlots = dto.replaceExisting
      ? []
      : await this.prisma.timetableSlot.findMany({ where: { sectionId: dto.sectionId } });
    const filledCells = new Set(existingSlots.map((s) => `${s.dayOfWeek}-${s.periodNo}`));

    // Teacher-conflict tracker: seeded with every OTHER section's existing
    // booking for the teachers we might place, so generation never
    // double-books a teacher school-wide - not just within this section.
    const teacherBusy = new Set<string>();
    if (teacherIds.length) {
      const clashCandidates = await this.prisma.timetableSlot.findMany({
        where: {
          teacherId: { in: teacherIds },
          ...(dto.replaceExisting ? {} : { NOT: { sectionId: dto.sectionId } }),
        },
        select: { teacherId: true, dayOfWeek: true, periodNo: true },
      });
      for (const c of clashCandidates) {
        teacherBusy.add(`${c.teacherId}-${c.dayOfWeek}-${c.periodNo}`);
      }
    }

    // Round-robin queue over the subject list so periods for one subject
    // spread across the week (Maths, English, Urdu, Maths, English, ...)
    // instead of clumping into consecutive periods.
    const remaining = new Map<string, number>(dto.subjects.map((s) => [s.subjectId, s.periodsPerWeek]));
    const teacherFor = new Map<string, string | undefined>(dto.subjects.map((s) => [s.subjectId, s.teacherId]));
    const queueOrder = dto.subjects.map((s) => s.subjectId);
    let queuePointer = 0;

    const takeNext = (): { subjectId: string; teacherId?: string } | null => {
      for (let i = 0; i < queueOrder.length; i++) {
        const subjectId = queueOrder[queuePointer % queueOrder.length];
        queuePointer++;
        const left = remaining.get(subjectId) ?? 0;
        if (left > 0) {
          remaining.set(subjectId, left - 1);
          return { subjectId, teacherId: teacherFor.get(subjectId) };
        }
      }
      return null;
    };

    const toPlace: {
      dayOfWeek: number;
      periodNo: number;
      subjectId: string;
      teacherId?: string;
      startTime: string;
      endTime: string;
    }[] = [];

    for (const cell of cells) {
      const key = `${cell.dayOfWeek}-${cell.periodNo}`;
      if (filledCells.has(key)) continue;

      // Pull candidates until one is teacher-conflict-free for this cell, or
      // we run out of remaining periods to place; put back anything skipped.
      let placed: { subjectId: string; teacherId?: string } | null = null;
      const skipped: { subjectId: string; teacherId?: string }[] = [];
      for (let attempt = 0; attempt < queueOrder.length; attempt++) {
        const candidate = takeNext();
        if (!candidate) break;
        const busyKey = candidate.teacherId ? `${candidate.teacherId}-${cell.dayOfWeek}-${cell.periodNo}` : null;
        if (busyKey && teacherBusy.has(busyKey)) {
          skipped.push(candidate);
          continue;
        }
        placed = candidate;
        break;
      }
      for (const s of skipped) {
        remaining.set(s.subjectId, (remaining.get(s.subjectId) ?? 0) + 1);
      }
      if (!placed) continue;

      const { startTime, endTime } = this.computePeriodTimes(dto.periodStartTime, dto.periodDurationMinutes, cell.periodNo);
      if (placed.teacherId) {
        teacherBusy.add(`${placed.teacherId}-${cell.dayOfWeek}-${cell.periodNo}`);
      }
      toPlace.push({ ...cell, subjectId: placed.subjectId, teacherId: placed.teacherId, startTime, endTime });
    }

    const warnings: string[] = [];
    for (const [subjectId, count] of remaining) {
      if (count > 0) {
        const name = subjectMap.get(subjectId)?.name ?? subjectId;
        warnings.push(`${name}: ${count} period(s) could not be placed (not enough free/conflict-free slots)`);
      }
    }

    if (toPlace.length === 0) {
      return { created: 0, slots: [], warnings: warnings.length ? warnings : ['No empty cells were available to fill'] };
    }

    const created = await this.prisma.$transaction(
      toPlace.map((slot) =>
        this.prisma.timetableSlot.create({
          data: {
            sectionId: dto.sectionId,
            subjectId: slot.subjectId,
            teacherId: slot.teacherId,
            dayOfWeek: slot.dayOfWeek,
            periodNo: slot.periodNo,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
          include: {
            subject: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        }),
      ),
    );

    return { created: created.length, slots: created, warnings };
  }

  // "08:00" + period 3 + 40min duration -> ("09:20", "10:00"). No break/
  // recess handling in v1 - periods are back-to-back from the start time.
  private computePeriodTimes(periodStartTime: string, durationMinutes: number, periodNo: number) {
    const [h, m] = periodStartTime.split(':').map((n) => parseInt(n, 10));
    const startTotal = h * 60 + m + (periodNo - 1) * durationMinutes;
    const endTotal = startTotal + durationMinutes;
    const fmt = (total: number) => {
      const hh = Math.floor(total / 60) % 24;
      const mm = total % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    return { startTime: fmt(startTotal), endTime: fmt(endTotal) };
  }
}
