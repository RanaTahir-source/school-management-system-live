import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSalaryStructureDto } from './dto/upsert-salary-structure.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const STRUCTURE_INCLUDE = {
  staff: { select: { id: true, employeeId: true, designation: true, user: { select: { id: true, fullName: true } } } },
} as const;

@Injectable()
export class SalaryStructureService {
  constructor(private readonly prisma: PrismaService) {}

  // Create-or-update: a staff member has at most one current structure -
  // setting a new one overwrites it (no salary-history tracking yet).
  async upsert(dto: UpsertSalaryStructureDto, currentUser: ScopedUser) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { id: dto.staffId, deletedAt: null } });
    if (!staff) throw new NotFoundException('Staff member not found');
    assertSchoolAccess(currentUser, staff.schoolId);

    return this.prisma.salaryStructure.upsert({
      where: { staffId: dto.staffId },
      create: {
        staffId: dto.staffId,
        basicPay: dto.basicPay,
        allowances: dto.allowances ?? 0,
        deductions: dto.deductions ?? 0,
      },
      update: {
        basicPay: dto.basicPay,
        allowances: dto.allowances ?? 0,
        deductions: dto.deductions ?? 0,
      },
      include: STRUCTURE_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.salaryStructure.findMany({
      where: scopedSchoolId ? { staff: { schoolId: scopedSchoolId } } : {},
      include: STRUCTURE_INCLUDE,
      orderBy: { staff: { employeeId: 'asc' } },
    });
  }

  async findForStaff(staffId: string, currentUser: ScopedUser) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { id: staffId, deletedAt: null } });
    if (!staff) throw new NotFoundException('Staff member not found');
    assertSchoolAccess(currentUser, staff.schoolId);

    return this.prisma.salaryStructure.findUnique({ where: { staffId }, include: STRUCTURE_INCLUDE });
  }
}
