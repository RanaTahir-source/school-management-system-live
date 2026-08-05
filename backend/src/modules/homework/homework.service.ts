import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { assertSchoolAccess } from '../../common/utils/school-scope';

type CurrentUser = { userId: string; roles: string[]; schoolId?: string | null };

const OVERRIDE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHomeworkDto, currentUser: CurrentUser) {
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

    return this.prisma.homework.create({
      data: {
        schoolId: section.class.schoolId,
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
        assignedById: currentUser.userId,
        title: dto.title,
        description: dto.description,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async update(id: string, dto: UpdateHomeworkDto, currentUser: CurrentUser) {
    const existing = await this.assertEditable(id, currentUser);

    return this.prisma.homework.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    const existing = await this.assertEditable(id, currentUser);
    await this.prisma.homework.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return { message: 'Homework removed' };
  }

  // Only the teacher who assigned it, or a school override role, may edit/delete.
  private async assertEditable(id: string, currentUser: CurrentUser) {
    const existing = await this.prisma.homework.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Homework not found');
    assertSchoolAccess(currentUser, existing.schoolId);

    const isOverride = currentUser.roles.some((r) => OVERRIDE_ROLES.includes(r));
    if (!isOverride && existing.assignedById !== currentUser.userId) {
      throw new ForbiddenException('You can only edit homework you assigned yourself');
    }
    return existing;
  }

  // Staff view: every homework entry set for a section, most recent first.
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
    return this.prisma.homework.findMany({
      where: { sectionId, deletedAt: null },
      include: {
        subject: { select: { name: true } },
        assignedBy: { select: { fullName: true } },
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  // "My homework": Student sees their own section's list; Teacher sees what
  // they personally assigned across every section they teach.
  async findMine(currentUser: CurrentUser) {
    if (currentUser.roles.includes('STUDENT')) {
      const profile = await this.prisma.studentProfile.findFirst({
        where: { userId: currentUser.userId, deletedAt: null },
      });
      if (!profile?.sectionId) return [];
      return this.listForSection(profile.sectionId);
    }

    if (currentUser.roles.includes('TEACHER')) {
      return this.prisma.homework.findMany({
        where: { assignedById: currentUser.userId, deletedAt: null },
        include: {
          subject: { select: { name: true } },
          section: { select: { name: true, class: { select: { name: true } } } },
        },
        orderBy: { dueDate: 'desc' },
      });
    }

    throw new ForbiddenException('No personal homework list for this role');
  }
}
