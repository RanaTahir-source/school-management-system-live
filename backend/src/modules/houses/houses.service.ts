import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/create-house.dto';
import { AwardHousePointsDto, AssignHouseDto } from './dto/award-house-points.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class HousesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHouseDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    const existing = await this.prisma.house.findFirst({
      where: { schoolId: dto.schoolId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('A house with this name already exists');
    return this.prisma.house.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name,
        colorHex: dto.colorHex,
        inChargeId: dto.inChargeId,
      },
    });
  }

  // Leaderboard order - highest points first, so this is ready to render
  // straight onto a dashboard without any client-side sorting.
  async findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.house.findMany({
      where: { deletedAt: null, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) },
      include: {
        inCharge: { select: { id: true, fullName: true } },
        _count: { select: { students: true } },
      },
      orderBy: { totalPoints: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const house = await this.prisma.house.findFirst({
      where: { id, deletedAt: null },
      include: {
        inCharge: { select: { id: true, fullName: true } },
        students: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: { id: true, admissionNo: true, user: { select: { fullName: true } }, section: { select: { name: true, class: { select: { name: true } } } } },
          orderBy: { admissionNo: 'asc' },
        },
        pointEntries: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { awardedBy: { select: { fullName: true } } },
        },
      },
    });
    if (!house) throw new NotFoundException('House not found');
    assertSchoolAccess(currentUser, house.schoolId);
    return house;
  }

  private async loadOrThrow(id: string, currentUser: ScopedUser) {
    const house = await this.prisma.house.findFirst({ where: { id, deletedAt: null } });
    if (!house) throw new NotFoundException('House not found');
    assertSchoolAccess(currentUser, house.schoolId);
    return house;
  }

  async update(id: string, dto: UpdateHouseDto, currentUser: ScopedUser) {
    await this.loadOrThrow(id, currentUser);
    return this.prisma.house.update({
      where: { id },
      data: {
        name: dto.name,
        colorHex: dto.colorHex,
        inChargeId: dto.inChargeId !== undefined ? dto.inChargeId || null : undefined,
        isActive: dto.isActive,
      },
    });
  }

  // Unassigns every student first (a House going away shouldn't leave dangling
  // references), then soft-deletes the house - the points history stays on
  // record for whoever looks at old HousePointEntry rows later.
  async remove(id: string, currentUser: ScopedUser) {
    await this.loadOrThrow(id, currentUser);
    const [, house] = await this.prisma.$transaction([
      this.prisma.studentProfile.updateMany({ where: { houseId: id }, data: { houseId: null } }),
      this.prisma.house.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } }),
    ]);
    return house;
  }

  async awardPoints(id: string, dto: AwardHousePointsDto, currentUser: ScopedUser & { userId: string }) {
    await this.loadOrThrow(id, currentUser);
    const [, house] = await this.prisma.$transaction([
      this.prisma.housePointEntry.create({
        data: {
          houseId: id,
          points: dto.points,
          reason: dto.reason,
          category: dto.category,
          date: dto.date ? new Date(dto.date) : undefined,
          awardedById: currentUser.userId,
        },
      }),
      this.prisma.house.update({
        where: { id },
        data: { totalPoints: { increment: dto.points } },
      }),
    ]);
    return house;
  }

  // Sets (or clears, when dto.houseId is null/omitted) one student's house -
  // the actual "put students on teams" step, kept here rather than inside
  // StudentsService so the existing student create/update flow is untouched.
  async assignStudent(studentId: string, dto: AssignHouseDto, currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true, user: { select: { schoolId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, student.user.schoolId);

    if (dto.houseId) {
      const house = await this.prisma.house.findFirst({ where: { id: dto.houseId, deletedAt: null } });
      if (!house) throw new NotFoundException('House not found');
      if (house.schoolId !== student.user.schoolId) {
        throw new ConflictException("This house belongs to a different school than the student's");
      }
    }

    return this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { houseId: dto.houseId || null },
      select: { id: true, houseId: true, house: { select: { id: true, name: true, colorHex: true } } },
    });
  }
}
