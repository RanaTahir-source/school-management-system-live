import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { RespondSuggestionDto } from './dto/respond-suggestion.dto';

const PERSON_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    branch: { select: { id: true, name: true } },
    submittedBy: { select: PERSON_SELECT },
    respondedBy: { select: PERSON_SELECT },
  };

  // Management views must never reveal who submitted an anonymous
  // suggestion, even though the row keeps submittedById for audit/anti-abuse
  // purposes. Strip it here, in one place, rather than trusting every caller
  // to remember.
  private sanitize<T extends { isAnonymous: boolean; submittedById: string | null; submittedBy: unknown }>(row: T) {
    if (!row.isAnonymous) return row;
    return { ...row, submittedById: null, submittedBy: null };
  }

  async create(dto: CreateSuggestionDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    return this.prisma.suggestion.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        category: dto.category,
        message: dto.message,
        isAnonymous: dto.isAnonymous ?? true,
        submittedById: currentUser.userId,
      },
    });
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; status?: string; category?: string },
  ) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);

    const rows = await this.prisma.suggestion.findMany({
      where: {
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => this.sanitize(r));
  }

  // What I personally submitted, so I can track the response even to my own
  // anonymous suggestions - identity is only hidden from OTHER people.
  async mine(currentUser: ScopedUser & { userId: string }) {
    return this.prisma.suggestion.findMany({
      where: { submittedById: currentUser.userId },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const suggestion = await this.prisma.suggestion.findFirst({ where: { id }, include: this.include });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    assertSchoolAccess(currentUser, suggestion.schoolId);
    return this.sanitize(suggestion);
  }

  async respond(id: string, dto: RespondSuggestionDto, currentUser: ScopedUser & { userId: string }) {
    const suggestion = await this.prisma.suggestion.findFirst({ where: { id } });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    assertSchoolAccess(currentUser, suggestion.schoolId);

    const updated = await this.prisma.suggestion.update({
      where: { id },
      data: {
        status: dto.status,
        adminResponse: dto.adminResponse,
        respondedById: currentUser.userId,
        respondedAt: new Date(),
      },
      include: this.include,
    });

    // Only notify a non-anonymous submitter - notifying an "anonymous" one
    // would out them the moment they see an in-app notification about it.
    if (!suggestion.isAnonymous && suggestion.submittedById) {
      await this.prisma.notification.create({
        data: {
          userId: suggestion.submittedById,
          type: 'SYSTEM',
          title: 'Your suggestion received a response',
          body: dto.adminResponse ?? `Status updated to ${dto.status}`,
        },
      });
    }

    return this.sanitize(updated);
  }
}
