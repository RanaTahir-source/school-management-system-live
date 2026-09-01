import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';
import { CreateThreadDto } from './dto/create-thread.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { AddThreadMembersDto } from './dto/add-thread-members.dto';

const PERSON_SELECT = { id: true, fullName: true } as const;
const MANAGE_ROLES = ['CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'];

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly threadInclude = {
    branch: { select: { id: true, name: true } },
    section: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
    createdBy: { select: PERSON_SELECT },
    members: { include: { user: { select: PERSON_SELECT } } },
  };

  isManager(currentUser: ScopedUser) {
    return MANAGE_ROLES.some((r) => currentUser.roles.includes(r));
  }

  private async getMembership(threadId: string, userId: string) {
    return this.prisma.chatThreadMember.findUnique({ where: { threadId_userId: { threadId, userId } } });
  }

  // Every mutating chat action starts here - loads the thread and proves
  // the caller is actually a member before touching anything. Public so
  // ChatCallService can reuse the exact same membership/role check for
  // starting or joining a video call - a socket or a call can never do
  // anything the REST chat API wouldn't also allow.
  async assertMember(threadId: string, currentUser: ScopedUser & { userId: string }) {
    const thread = await this.prisma.chatThread.findFirst({ where: { id: threadId, deletedAt: null } });
    if (!thread) throw new NotFoundException('Conversation not found');
    const membership = await this.getMembership(threadId, currentUser.userId);
    if (!membership) throw new ForbiddenException('You are not part of this conversation');
    return { thread, membership };
  }

  // STAFF_GROUP / BROADCAST - manually curated membership. BROADCAST
  // (whole-school/whole-parent notice board) is restricted to management
  // roles since it can reach every parent in the school.
  async createGroup(dto: CreateThreadDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (dto.type === 'BROADCAST' && !this.isManager(currentUser)) {
      throw new ForbiddenException('Only school management can create a broadcast group');
    }

    const memberIds = Array.from(new Set([...dto.memberIds, currentUser.userId]));
    const members = await this.prisma.user.findMany({
      where: { id: { in: memberIds }, deletedAt: null, isActive: true },
      select: { id: true, schoolId: true },
    });
    if (members.length !== memberIds.length) {
      throw new BadRequestException('One or more members were not found or are inactive');
    }
    const isUnrestricted = currentUser.roles.includes('CHAIRMAN');
    if (!isUnrestricted && members.some((m) => m.schoolId !== dto.schoolId)) {
      throw new BadRequestException('All members must belong to the same school');
    }

    const thread = await this.prisma.chatThread.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        type: dto.type,
        title: dto.title,
        postingRestricted: dto.type === 'BROADCAST' ? true : dto.postingRestricted ?? false,
        createdById: currentUser.userId,
        members: {
          create: memberIds.map((userId) => ({
            userId,
            role: userId === currentUser.userId ? 'MODERATOR' : 'MEMBER',
          })),
        },
      },
      include: this.threadInclude,
    });

    return thread;
  }

  // The section's class teacher + every linked parent, auto-resolved and
  // kept in sync (new parents/teacher changes get added, nobody is ever
  // silently removed here - use removeMember explicitly for that).
  async getOrCreateSectionGroup(sectionId: string, currentUser: ScopedUser & { userId: string }) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: { select: { id: true, name: true, schoolId: true, branchId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    const parentLinks = await this.prisma.parentStudent.findMany({
      where: { student: { sectionId } },
      select: { parentId: true },
    });
    const memberIds = Array.from(new Set([...parentLinks.map((p) => p.parentId), ...(section.classTeacherId ? [section.classTeacherId] : [])]));

    let thread = await this.prisma.chatThread.findFirst({ where: { type: 'CLASS_GROUP', sectionId, deletedAt: null } });

    if (!thread) {
      thread = await this.prisma.chatThread.create({
        data: {
          schoolId: section.class.schoolId,
          branchId: section.class.branchId,
          type: 'CLASS_GROUP',
          title: `${section.class.name} - ${section.name} Group`,
          sectionId,
          createdById: currentUser.userId,
          members: {
            create: memberIds.map((userId) => ({ userId, role: userId === section.classTeacherId ? 'MODERATOR' : 'MEMBER' })),
          },
        },
      });
    } else if (memberIds.length) {
      await this.prisma.chatThreadMember.createMany({
        data: memberIds.map((userId) => ({ threadId: thread!.id, userId, role: userId === section.classTeacherId ? 'MODERATOR' : 'MEMBER' })),
        skipDuplicates: true,
      });
    }

    return this.prisma.chatThread.findUnique({ where: { id: thread.id }, include: this.threadInclude });
  }

  async findOrCreateDirect(otherUserId: string, currentUser: ScopedUser & { userId: string }) {
    if (otherUserId === currentUser.userId) {
      throw new BadRequestException('You cannot start a conversation with yourself');
    }
    const other = await this.prisma.user.findFirst({ where: { id: otherUserId, deletedAt: null, isActive: true } });
    if (!other) throw new NotFoundException('User not found');

    const isUnrestricted = currentUser.roles.includes('CHAIRMAN');
    if (!isUnrestricted) {
      if (!currentUser.schoolId) throw new ForbiddenException('Your account is not assigned to a school');
      if (other.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException('You can only message people at your own school');
      }
    }

    const candidates = await this.prisma.chatThread.findMany({
      where: {
        type: 'DIRECT',
        deletedAt: null,
        members: { some: { userId: currentUser.userId } },
      },
      include: { members: true },
    });
    const existing = candidates.find((t) => t.members.length === 2 && t.members.some((m) => m.userId === otherUserId));
    if (existing) {
      return this.prisma.chatThread.findUnique({ where: { id: existing.id }, include: this.threadInclude });
    }

    const schoolId = currentUser.schoolId ?? other.schoolId;
    if (!schoolId) throw new BadRequestException('Could not determine the school this conversation belongs to');

    const thread = await this.prisma.chatThread.create({
      data: {
        schoolId,
        type: 'DIRECT',
        createdById: currentUser.userId,
        members: { create: [{ userId: currentUser.userId }, { userId: otherUserId }] },
      },
      include: this.threadInclude,
    });
    return thread;
  }

  async myThreads(currentUser: ScopedUser & { userId: string }) {
    const memberships = await this.prisma.chatThreadMember.findMany({
      where: { userId: currentUser.userId, thread: { deletedAt: null } },
      include: { thread: { include: this.threadInclude } },
      orderBy: { thread: { updatedAt: 'desc' } },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const [lastMessage, unreadCount] = await Promise.all([
          this.prisma.chatMessage.findFirst({
            where: { threadId: m.threadId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: PERSON_SELECT } },
          }),
          this.prisma.chatMessage.count({
            where: {
              threadId: m.threadId,
              deletedAt: null,
              senderId: { not: currentUser.userId },
              ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
            },
          }),
        ]);
        return { ...m.thread, myRole: m.role, lastMessage, unreadCount };
      }),
    );
  }

  async getMessages(threadId: string, currentUser: ScopedUser & { userId: string }, opts: { before?: string; limit?: number }) {
    await this.assertMember(threadId, currentUser);
    const limit = Math.min(opts.limit ?? 50, 100);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        threadId,
        deletedAt: null,
        ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}),
      },
      include: { sender: { select: PERSON_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async sendMessage(threadId: string, dto: SendChatMessageDto, currentUser: ScopedUser & { userId: string }) {
    const { thread, membership } = await this.assertMember(threadId, currentUser);
    if (thread.postingRestricted && membership.role !== 'MODERATOR' && !this.isManager(currentUser)) {
      throw new ForbiddenException('Only moderators can post in this broadcast group');
    }

    const message = await this.prisma.chatMessage.create({
      data: { threadId, senderId: currentUser.userId, body: dto.body, attachmentUrl: dto.attachmentUrl },
      include: { sender: { select: PERSON_SELECT } },
    });
    await this.prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    return message;
  }

  async markRead(threadId: string, currentUser: ScopedUser & { userId: string }) {
    const { membership } = await this.assertMember(threadId, currentUser);
    return this.prisma.chatThreadMember.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } });
  }

  async addMembers(threadId: string, dto: AddThreadMembersDto, currentUser: ScopedUser & { userId: string }) {
    const { thread, membership } = await this.assertMember(threadId, currentUser);
    if (thread.type === 'DIRECT') throw new BadRequestException('Cannot add members to a direct conversation');
    if (membership.role !== 'MODERATOR' && !this.isManager(currentUser)) {
      throw new ForbiddenException('Only a moderator can add members');
    }

    await this.prisma.chatThreadMember.createMany({
      data: dto.memberIds.map((userId) => ({ threadId, userId })),
      skipDuplicates: true,
    });
    return this.prisma.chatThread.findUnique({ where: { id: threadId }, include: this.threadInclude });
  }

  async removeMember(threadId: string, userId: string, currentUser: ScopedUser & { userId: string }) {
    const { thread, membership } = await this.assertMember(threadId, currentUser);
    if (thread.type === 'DIRECT') throw new BadRequestException('Cannot remove members from a direct conversation');
    const isSelfLeaving = userId === currentUser.userId;
    if (!isSelfLeaving && membership.role !== 'MODERATOR' && !this.isManager(currentUser)) {
      throw new ForbiddenException('Only a moderator can remove other members');
    }
    await this.prisma.chatThreadMember.deleteMany({ where: { threadId, userId } });
    return { success: true };
  }
}
