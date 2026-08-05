import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
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
}
