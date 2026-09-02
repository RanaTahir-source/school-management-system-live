import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { AddAttendeesDto } from './dto/add-attendees.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

const ATTENDEE_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    branch: { select: { id: true, name: true } },
    createdBy: { select: ATTENDEE_SELECT },
    attendees: {
      include: { user: { select: ATTENDEE_SELECT } },
    },
  };

  private async notifyAttendees(meetingId: string, title: string, body: string, userIds: string[]) {
    if (!userIds.length) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type: 'SYSTEM' as const, title, body })),
    });
    await this.prisma.meetingAttendee.updateMany({
      where: { meetingId, userId: { in: userIds } },
      data: { notifiedAt: new Date() },
    });
  }

  async create(dto: CreateMeetingDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const attendeeIds = Array.from(new Set(dto.attendeeIds ?? []));

    const meeting = await this.prisma.meeting.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        title: dto.title,
        agenda: dto.agenda,
        scheduledAt: new Date(dto.scheduledAt),
        location: dto.location,
        createdById: currentUser.userId,
        attendees: {
          create: attendeeIds.map((userId) => ({ userId })),
        },
      },
      include: this.include,
    });

    await this.notifyAttendees(
      meeting.id,
      `Meeting scheduled: ${meeting.title}`,
      `${new Date(meeting.scheduledAt).toLocaleString()}${meeting.location ? ` · ${meeting.location}` : ''}`,
      attendeeIds,
    );

    return this.findOne(meeting.id, currentUser);
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; status?: string; from?: string; to?: string },
  ) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);

    return this.prisma.meeting.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.from || filters.to
          ? {
              scheduledAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: this.include,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  // Meetings the current user personally has to know about - either they
  // scheduled it, or they were invited as an attendee. Not school-scoped by
  // role since it's inherently "things that involve me".
  async mine(currentUser: ScopedUser & { userId: string }) {
    return this.prisma.meeting.findMany({
      where: {
        deletedAt: null,
        OR: [{ createdById: currentUser.userId }, { attendees: { some: { userId: currentUser.userId } } }],
      },
      include: this.include,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const meeting = await this.prisma.meeting.findFirst({ where: { id, deletedAt: null }, include: this.include });
    if (!meeting) throw new NotFoundException('Meeting not found');
    assertSchoolAccess(currentUser, meeting.schoolId);
    return meeting;
  }

  async update(id: string, dto: UpdateMeetingDto, currentUser: ScopedUser) {
    const existing = await this.findOne(id, currentUser);

    // attendeeIds, when present, is a full replacement of the attendee list
    // (the "Edit Details" flow) - diffed against the current roster so we
    // only touch what actually changed, and only notify people newly added.
    const { attendeeIds, ...rest } = dto;
    let newlyAddedIds: string[] = [];

    if (attendeeIds) {
      const desiredIds = Array.from(new Set(attendeeIds));
      const currentIds = existing.attendees.map((a) => a.userId);
      newlyAddedIds = desiredIds.filter((uid) => !currentIds.includes(uid));
      const removedIds = currentIds.filter((uid) => !desiredIds.includes(uid));

      if (removedIds.length) {
        await this.prisma.meetingAttendee.deleteMany({ where: { meetingId: id, userId: { in: removedIds } } });
      }
      if (newlyAddedIds.length) {
        await this.prisma.meetingAttendee.createMany({
          data: newlyAddedIds.map((userId) => ({ meetingId: id, userId })),
          skipDuplicates: true,
        });
      }
    }

    const meeting = await this.prisma.meeting.update({
      where: { id },
      data: {
        ...rest,
        scheduledAt: rest.scheduledAt ? new Date(rest.scheduledAt) : undefined,
      },
      include: this.include,
    });

    if (newlyAddedIds.length) {
      await this.notifyAttendees(
        id,
        `Meeting updated: ${meeting.title}`,
        `${new Date(meeting.scheduledAt).toLocaleString()}${meeting.location ? ` · ${meeting.location}` : ''}`,
        newlyAddedIds,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: meeting.schoolId,
        action: 'MEETING_UPDATED',
        entity: 'Meeting',
        entityId: id,
      },
    });

    return this.findOne(id, currentUser);
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addAttendees(id: string, dto: AddAttendeesDto, currentUser: ScopedUser) {
    const meeting = await this.findOne(id, currentUser);
    const existingIds = new Set(meeting.attendees.map((a) => a.userId));
    const newIds = dto.attendeeIds.filter((userId) => !existingIds.has(userId));

    if (newIds.length) {
      await this.prisma.meetingAttendee.createMany({
        data: newIds.map((userId) => ({ meetingId: id, userId })),
        skipDuplicates: true,
      });
      await this.notifyAttendees(
        id,
        `Meeting scheduled: ${meeting.title}`,
        `${new Date(meeting.scheduledAt).toLocaleString()}${meeting.location ? ` · ${meeting.location}` : ''}`,
        newIds,
      );
    }

    return this.findOne(id, currentUser);
  }

  async markAttendance(id: string, userId: string, dto: MarkAttendanceDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    const attendee = await this.prisma.meetingAttendee.findUnique({
      where: { meetingId_userId: { meetingId: id, userId } },
    });
    if (!attendee) throw new NotFoundException('This person is not an attendee of this meeting');

    await this.prisma.meetingAttendee.update({
      where: { meetingId_userId: { meetingId: id, userId } },
      data: { attended: dto.attended },
    });

    return this.findOne(id, currentUser);
  }

  async removeAttendee(id: string, userId: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    await this.prisma.meetingAttendee.deleteMany({ where: { meetingId: id, userId } });
    return this.findOne(id, currentUser);
  }
}
