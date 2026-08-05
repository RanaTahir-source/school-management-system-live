import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffProfileDto, UpdateStaffProfileDto } from './dto/create-staff-profile.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const STAFF_PROFILE_INCLUDE = {
  user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } },
} as const;

@Injectable()
export class StaffProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffProfileDto, currentUser: ScopedUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      include: { staffProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.schoolId) throw new ConflictException('This user is not assigned to a school yet');
    assertSchoolAccess(currentUser, user.schoolId);
    if (user.staffProfile) {
      throw new ConflictException('This user already has a staff profile');
    }

    const existingEmployeeId = await this.prisma.staffProfile.findFirst({
      where: { schoolId: user.schoolId, employeeId: dto.employeeId, deletedAt: null },
    });
    if (existingEmployeeId) {
      throw new ConflictException('This employee ID is already in use in this school');
    }

    return this.prisma.staffProfile.create({
      data: {
        userId: dto.userId,
        schoolId: user.schoolId,
        branchId: user.branchId,
        employeeId: dto.employeeId,
        category: dto.category,
        designation: dto.designation,
        education: dto.education,
        cnic: dto.cnic,
        address: dto.address,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        basicPay: dto.basicPay,
      },
      include: STAFF_PROFILE_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.staffProfile.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      include: STAFF_PROFILE_INCLUDE,
      orderBy: { employeeId: 'asc' },
    });
  }

  // Users in this school who don't have a staff profile yet (and aren't
  // students) - the pool of candidates for "attach staff profile".
  async eligibleUsers(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        staffProfile: { is: null },
        studentProfile: { is: null },
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async update(id: string, dto: UpdateStaffProfileDto, currentUser: ScopedUser) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { id, deletedAt: null } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    assertSchoolAccess(currentUser, staff.schoolId);

    if (dto.employeeId && dto.employeeId !== staff.employeeId) {
      const clash = await this.prisma.staffProfile.findFirst({
        where: { schoolId: staff.schoolId, employeeId: dto.employeeId, deletedAt: null, NOT: { id } },
      });
      if (clash) throw new ConflictException('This employee ID is already in use in this school');
    }

    return this.prisma.staffProfile.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        category: dto.category,
        designation: dto.designation,
        education: dto.education,
        cnic: dto.cnic,
        address: dto.address,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        basicPay: dto.basicPay,
        isActive: dto.isActive,
      },
      include: STAFF_PROFILE_INCLUDE,
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { id, deletedAt: null } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    assertSchoolAccess(currentUser, staff.schoolId);
    return this.prisma.staffProfile.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
