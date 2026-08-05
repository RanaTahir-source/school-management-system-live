import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { SendMessageDto } from './dto/send-message.dto';
import { ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // Internal messaging is deliberately simple and school-scoped: you can
  // only message users in your own school (Chairman can message anyone,
  // since they aren't tied to one school).
  async send(dto: SendMessageDto, currentUser: ScopedUser & { userId: string }) {
    const recipients = await this.prisma.user.findMany({
      where: { id: { in: dto.recipientIds }, deletedAt: null, isActive: true },
      select: { id: true, schoolId: true },
    });
    if (recipients.length !== dto.recipientIds.length) {
      throw new BadRequestException('One or more recipients were not found or are inactive');
    }

    const isUnrestricted = currentUser.roles.some((r) => ['CHAIRMAN'].includes(r));
    if (!isUnrestricted) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException('Your account is not assigned to a school');
      }
      const outsideSchool = recipients.some((r) => r.schoolId !== currentUser.schoolId);
      if (outsideSchool) {
        throw new ForbiddenException('You can only message people at your own school');
      }
    }

    const schoolId = currentUser.schoolId ?? recipients[0]?.schoolId ?? null;
    if (!schoolId) {
      throw new BadRequestException('Could not determine the school this message belongs to');
    }

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          schoolId,
          senderId: currentUser.userId,
          subject: dto.subject,
          body: dto.body,
          recipients: {
            create: dto.recipientIds.map((recipientId) => ({ recipientId })),
          },
        },
        include: { recipients: true },
      });

      await tx.notification.createMany({
        data: dto.recipientIds.map((userId) => ({
          userId,
          type: NotificationType.MESSAGE,
          title: dto.subject || 'New message',
          body: dto.body,
        })),
      });

      return message;
    });
  }

  async inbox(currentUser: ScopedUser & { userId: string }) {
    return this.prisma.message.findMany({
      where: {
        deletedAt: null,
        recipients: { some: { recipientId: currentUser.userId } },
      },
      include: {
        sender: { select: { id: true, fullName: true } },
        recipients: { where: { recipientId: currentUser.userId }, select: { readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sent(currentUser: ScopedUser & { userId: string }) {
    return this.prisma.message.findMany({
      where: { deletedAt: null, senderId: currentUser.userId },
      include: {
        recipients: { include: { recipient: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser & { userId: string }) {
    const message = await this.prisma.message.findFirst({
      where: { id, deletedAt: null },
      include: {
        sender: { select: { id: true, fullName: true } },
        recipients: { include: { recipient: { select: { id: true, fullName: true } } } },
      },
    });
    if (!message) throw new NotFoundException('Message not found');

    const isParty =
      message.senderId === currentUser.userId ||
      message.recipients.some((r) => r.recipientId === currentUser.userId);
    if (!isParty) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    return message;
  }

  async markRead(id: string, currentUser: ScopedUser & { userId: string }) {
    const recipientRow = await this.prisma.messageRecipient.findUnique({
      where: { messageId_recipientId: { messageId: id, recipientId: currentUser.userId } },
    });
    if (!recipientRow) {
      throw new NotFoundException('Message not found in your inbox');
    }
    return this.prisma.messageRecipient.update({
      where: { id: recipientRow.id },
      data: { readAt: recipientRow.readAt ?? new Date() },
    });
  }
}
