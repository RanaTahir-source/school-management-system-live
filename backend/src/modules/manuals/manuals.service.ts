import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';

const PERSON_SELECT = { id: true, fullName: true } as const;
const MANAGE_ROLES = ['CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL'];

@Injectable()
export class ManualsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    createdBy: { select: PERSON_SELECT },
    updatedBy: { select: PERSON_SELECT },
  };

  private isChairman(currentUser: ScopedUser) {
    return currentUser.roles.includes('CHAIRMAN');
  }

  private isManager(currentUser: ScopedUser) {
    return MANAGE_ROLES.some((r) => currentUser.roles.includes(r));
  }

  // Global bundled manuals (schoolId null) can only be authored by CHAIRMAN -
  // everyone else's `create()` without a schoolId falls back to their own
  // school, producing a school-specific CUSTOM-style manual instead.
  async create(dto: CreateManualDto, currentUser: ScopedUser & { userId: string }) {
    const isChairman = this.isChairman(currentUser);
    const targetSchoolId = dto.schoolId ?? (isChairman ? null : currentUser.schoolId ?? null);

    if (targetSchoolId) {
      assertSchoolAccess(currentUser, targetSchoolId);
    } else if (!isChairman) {
      throw new BadRequestException('Your account is not assigned to a school');
    }

    return this.prisma.manualDocument.create({
      data: {
        schoolId: targetSchoolId,
        category: dto.category,
        title: dto.title,
        slug: dto.slug,
        summary: dto.summary,
        content: dto.content,
        isPublished: dto.isPublished ?? true,
        createdById: currentUser.userId,
      },
      include: this.include,
    });
  }

  // Every school sees the global bundled library (schoolId null) plus its
  // own custom manuals. Drafts (isPublished:false) are only shown to
  // managers - regular staff/parents/students only ever see published ones.
  async findAll(currentUser: ScopedUser, filters: { schoolId?: string; category?: string; search?: string }) {
    const isChairman = this.isChairman(currentUser);
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);

    const and: any[] = [{ deletedAt: null }];

    if (!(isChairman && !effectiveSchoolId)) {
      and.push({ OR: [{ schoolId: null }, { schoolId: effectiveSchoolId }] });
    }
    if (!this.isManager(currentUser)) {
      and.push({ isPublished: true });
    }
    if (filters.category) and.push({ category: filters.category });
    if (filters.search) {
      and.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { summary: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    return this.prisma.manualDocument.findMany({
      where: { AND: and },
      include: this.include,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const manual = await this.prisma.manualDocument.findFirst({ where: { id, deletedAt: null }, include: this.include });
    if (!manual) throw new NotFoundException('Manual not found');

    if (manual.schoolId) {
      assertSchoolAccess(currentUser, manual.schoolId);
    }
    if (!manual.isPublished && !this.isManager(currentUser)) {
      throw new NotFoundException('Manual not found');
    }
    return manual;
  }

  // assertSchoolAccess naturally blocks non-CHAIRMAN users here: a global
  // manual has schoolId===null, and assertSchoolAccess(user, null) throws
  // Forbidden for anyone who isn't in UNRESTRICTED_ROLES (CHAIRMAN).
  private async assertCanManage(id: string, currentUser: ScopedUser) {
    const manual = await this.prisma.manualDocument.findFirst({ where: { id, deletedAt: null } });
    if (!manual) throw new NotFoundException('Manual not found');
    assertSchoolAccess(currentUser, manual.schoolId);
    return manual;
  }

  async update(id: string, dto: UpdateManualDto, currentUser: ScopedUser & { userId: string }) {
    const manual = await this.assertCanManage(id, currentUser);
    return this.prisma.manualDocument.update({
      where: { id },
      data: {
        ...dto,
        version: dto.content && dto.content !== manual.content ? { increment: 1 } : undefined,
        updatedById: currentUser.userId,
      },
      include: this.include,
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.assertCanManage(id, currentUser);
    return this.prisma.manualDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
