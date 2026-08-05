import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOnlineClassDto } from './dto/create-online-class.dto';
import { UpdateOnlineClassDto } from './dto/update-online-class.dto';
import { assertSchoolAccess } from '../../common/utils/school-scope';

type CurrentUser = { userId: string; roles: string[]; schoolId?: string | null };

const OVERRIDE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];

const listInclude = {
  subject: { select: { name: true } },
  teacher: { select: { fullName: true } },
} as const;

@Injectable()
export class OnlineClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOnlineClassDto, currentUser: CurrentUser) {
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, deletedAt: null },
      include: { class: { select: { schoolId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, schoolId: section.class.schoolId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found in this school');

    return this.prisma.onlineClass.create({
      data: {
        schoolId: section.class.schoolId,
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
        teacherId: currentUser.userId,
        title: dto.title,
        description: dto.description,
        meetingLink: dto.meetingLink,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 40,
      },
    });
  }

  async update(id: string, dto: UpdateOnlineClassDto, currentUser: CurrentUser) {
    const existing = await this.assertEditable(id, currentUser);

    return this.prisma.onlineClass.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        description: dto.description,
        meetingLink: dto.meetingLink,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        durationMinutes: dto.durationMinutes,
      },
    });
  }

  // Marks it cancelled but keeps it visible in the list (with a "Cancelled"
  // badge) rather than deleting it, since students may already be expecting it.
  async cancel(id: string, currentUser: CurrentUser) {
    const existing = await this.assertEditable(id, currentUser);
    return this.prisma.onlineClass.update({ where: { id: existing.id }, data: { isCancelled: true } });
  }

  async remove(id: string, currentUser: CurrentUser) {
    const existing = await this.assertEditable(id, currentUser);
    await this.prisma.onlineClass.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return { message: 'Online class removed' };
  }

  // Only the teacher who scheduled it, or a school override role, may edit/cancel/delete.
  private async assertEditable(id: string, currentUser: CurrentUser) {
    const existing = await this.prisma.onlineClass.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Online class not found');
    assertSchoolAccess(currentUser, existing.schoolId);

    const isOverride = currentUser.roles.some((r) => OVERRIDE_ROLES.includes(r));
    if (!isOverride && existing.teacherId !== currentUser.userId) {
      throw new ForbiddenException('You can only edit online classes you scheduled yourself');
    }
    return existing;
  }

  // Staff view: every online class scheduled for a section, soonest first.
  async findBySection(sectionId: string, currentUser: CurrentUser) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      include: { class: { select: { schoolId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    return this.listForSection(sectionId);
  }

  // Public so ParentPortalService can reuse it once it has confirmed the
  // caller's child is actually enrolled in this section.
  listForSection(sectionId: string) {
    return this.prisma.onlineClass.findMany({
      where: { sectionId, deletedAt: null },
      include: listInclude,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  // "My online classes": Student sees their own section's list; Teacher sees
  // what they personally scheduled across every section they teach.
  async findMine(currentUser: CurrentUser) {
    if (currentUser.roles.includes('STUDENT')) {
      const profile = await this.prisma.studentProfile.findFirst({
        where: { userId: currentUser.userId, deletedAt: null },
      });
      if (!profile?.sectionId) return [];
      return this.listForSection(profile.sectionId);
    }

    if (currentUser.roles.includes('TEACHER')) {
      return this.prisma.onlineClass.findMany({
        where: { teacherId: currentUser.userId, deletedAt: null },
        include: {
          subject: { select: { name: true } },
          section: { select: { name: true, class: { select: { name: true } } } },
        },
        orderBy: { scheduledAt: 'desc' },
      });
    }

    throw new ForbiddenException('No personal online class list for this role');
  }
}
