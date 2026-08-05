import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllocateRoomDto, VacateRoomDto } from './dto/allocate-room.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const ALLOCATION_INCLUDE = {
  room: { select: { id: true, roomNo: true, block: true, monthlyFee: true } },
  student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
} as const;

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate(dto: AllocateRoomDto, currentUser: ScopedUser) {
    const room = await this.prisma.hostelRoom.findFirst({ where: { id: dto.roomId, deletedAt: null } });
    if (!room) throw new NotFoundException('Room not found');
    assertSchoolAccess(currentUser, room.schoolId);

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, deletedAt: null },
      include: { user: { select: { schoolId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.user.schoolId !== room.schoolId) {
      throw new ConflictException('This student belongs to a different school than the room');
    }

    const existing = await this.prisma.hostelAllocation.findFirst({
      where: { studentId: dto.studentId, isActive: true },
    });
    if (existing) {
      throw new ConflictException('This student already has an active hostel room - vacate it first');
    }

    const occupied = await this.prisma.hostelAllocation.count({ where: { roomId: dto.roomId, isActive: true } });
    if (occupied >= room.capacity) {
      throw new ConflictException('This room is already at full capacity');
    }

    return this.prisma.hostelAllocation.create({
      data: {
        roomId: dto.roomId,
        studentId: dto.studentId,
        checkInDate: dto.checkInDate ? new Date(dto.checkInDate) : new Date(),
        remarks: dto.remarks,
      },
      include: ALLOCATION_INCLUDE,
    });
  }

  async vacate(id: string, dto: VacateRoomDto, currentUser: ScopedUser) {
    const allocation = await this.findOrThrow(id, currentUser);
    if (!allocation.isActive) {
      throw new ConflictException('This allocation has already been vacated');
    }
    return this.prisma.hostelAllocation.update({
      where: { id },
      data: {
        isActive: false,
        checkOutDate: dto.checkOutDate ? new Date(dto.checkOutDate) : new Date(),
        remarks: dto.remarks ?? allocation.remarks,
      },
      include: ALLOCATION_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, roomId?: string, isActive?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.hostelAllocation.findMany({
      where: {
        ...(roomId ? { roomId } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        ...(scopedSchoolId ? { room: { schoolId: scopedSchoolId } } : {}),
      },
      include: ALLOCATION_INCLUDE,
      orderBy: { checkInDate: 'desc' },
    });
  }

  async mine(userId: string) {
    const student = await this.prisma.studentProfile.findFirst({ where: { userId } });
    if (!student) throw new NotFoundException('No student profile linked to this account');
    return this.prisma.hostelAllocation.findMany({
      where: { studentId: student.id },
      include: ALLOCATION_INCLUDE,
      orderBy: { checkInDate: 'desc' },
    });
  }

  private async findOrThrow(id: string, currentUser: ScopedUser) {
    const allocation = await this.prisma.hostelAllocation.findFirst({ where: { id }, include: { room: true } });
    if (!allocation) throw new NotFoundException('Allocation not found');
    assertSchoolAccess(currentUser, allocation.room.schoolId);
    return allocation;
  }
}
