import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateStaffTaskDto } from './dto/create-staff-task.dto';
import { UpdateStaffTaskDto } from './dto/update-staff-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

const PERSON_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class StaffTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    branch: { select: { id: true, name: true } },
    assignedTo: { select: PERSON_SELECT },
    assignedBy: { select: PERSON_SELECT },
  };

  async create(dto: CreateStaffTaskDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const task = await this.prisma.staffTask.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToId: dto.assignedToId,
        assignedById: currentUser.userId,
      },
      include: this.include,
    });

    await this.prisma.notification.create({
      data: {
        userId: dto.assignedToId,
        type: 'SYSTEM',
        title: `New task assigned: ${task.title}`,
        body: dto.dueDate ? `Due ${new Date(dto.dueDate).toLocaleDateString()}` : undefined,
      },
    });

    return task;
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; status?: string; priority?: string; assignedToId?: string },
  ) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);

    return this.prisma.staffTask.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.priority ? { priority: filters.priority as any } : {}),
        ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
      },
      include: this.include,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  // Tasks assigned to me - what a teacher/staff member sees on their own
  // "My Tasks" tab, regardless of role/permissions.
  async mine(currentUser: ScopedUser & { userId: string }) {
    return this.prisma.staffTask.findMany({
      where: { deletedAt: null, assignedToId: currentUser.userId },
      include: this.include,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const task = await this.prisma.staffTask.findFirst({ where: { id, deletedAt: null }, include: this.include });
    if (!task) throw new NotFoundException('Task not found');
    assertSchoolAccess(currentUser, task.schoolId);
    return task;
  }

  async update(id: string, dto: UpdateStaffTaskDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.staffTask.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: this.include,
    });
  }

  // Assignee can update their own task's status without needing manager
  // roles - that's the whole point of "track completion" self-service.
  async updateStatus(id: string, dto: UpdateTaskStatusDto, currentUser: ScopedUser & { userId: string }) {
    const task = await this.findOne(id, currentUser);
    const isManager = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'].some((r) => currentUser.roles.includes(r));
    if (task.assignedToId !== currentUser.userId && !isManager) {
      throw new ForbiddenException('Only the assignee or a manager can update this task');
    }

    return this.prisma.staffTask.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === 'COMPLETED' ? new Date() : dto.status === 'PENDING' || dto.status === 'IN_PROGRESS' ? null : undefined,
      },
      include: this.include,
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.staffTask.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
