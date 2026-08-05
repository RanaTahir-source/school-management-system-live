import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHostelRoomDto, UpdateHostelRoomDto } from './dto/create-room.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const ROOM_INCLUDE = {
  branch: { select: { id: true, name: true } },
  allocations: {
    where: { isActive: true },
    select: {
      id: true,
      checkInDate: true,
      student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
    },
  },
} as const;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHostelRoomDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.hostelRoom.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        roomNo: dto.roomNo,
        block: dto.block,
        floor: dto.floor,
        capacity: dto.capacity ?? 1,
        roomType: dto.roomType,
        monthlyFee: dto.monthlyFee,
      },
      include: ROOM_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, branchId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.hostelRoom.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: ROOM_INCLUDE,
      orderBy: { roomNo: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const room = await this.prisma.hostelRoom.findFirst({ where: { id, deletedAt: null }, include: ROOM_INCLUDE });
    if (!room) throw new NotFoundException('Room not found');
    assertSchoolAccess(currentUser, room.schoolId);
    return room;
  }

  async update(id: string, dto: UpdateHostelRoomDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.hostelRoom.update({ where: { id }, data: dto, include: ROOM_INCLUDE });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.hostelRoom.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
