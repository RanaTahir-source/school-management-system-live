import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

export type AuditLogQuery = {
  action?: string;
  entity?: string;
  userId?: string;
  schoolId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: ScopedUser, query: AuditLogQuery) {
    const schoolId = resolveSchoolScope(currentUser, query.schoolId);
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 && query.pageSize <= 200 ? query.pageSize : 50;

    const where = {
      ...(schoolId ? { schoolId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
      ...(query.entity ? { entity: { contains: query.entity, mode: 'insensitive' as const } } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { fullName: true, email: true } },
          school: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  // For the filter dropdown - every distinct action string seen so far.
  async distinctActions(currentUser: ScopedUser) {
    const schoolId = resolveSchoolScope(currentUser, undefined);
    const rows = await this.prisma.auditLog.findMany({
      where: schoolId ? { schoolId } : {},
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
