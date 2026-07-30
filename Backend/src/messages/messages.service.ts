import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const SENDER_SELECT = { id: true, firstName: true, lastName: true, agencyName: true, roles: true } as const;
const REPLY_TO_SELECT = {
  id: true, content: true, senderId: true, deletedAt: true,
  sender: { select: SENDER_SELECT },
} as const;
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pusher: PusherService,
    private readonly notifications: NotificationsService,
  ) {}

  async findRooms(userId: string) {
    return this.prisma.messageRoom.findMany({
      where: { participants: { some: { id: userId } } },
      include: {
        listing: { select: { id: true, title: true, images: true } },
        participants: { select: { id: true, firstName: true, lastName: true, avatar: true, agencyName: true, roles: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMessages(roomId: string, userId: string, page = 1, limit = 50) {
    await this.assertParticipant(roomId, userId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return this.prisma.message.findMany({
      where: { roomId },
      include: {
        sender:  { select: SENDER_SELECT },
        replyTo: { select: REPLY_TO_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
  }

  async createRoom(listingId: string, tenantId: string, callerId?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId === tenantId) {
      throw new BadRequestException('You cannot send a message to yourself');
    }
    // Si le caller n'est ni le locataire ni le propriétaire → interdit
    if (callerId && callerId !== tenantId && callerId !== listing.ownerId) {
      throw new ForbiddenException('Not authorized');
    }
    const existing = await this.prisma.messageRoom.findFirst({
      where: { listingId, participants: { some: { id: tenantId } } },
    });
    if (existing) return existing;
    return this.prisma.messageRoom.create({
      data: {
        listingId,
        participants: {
          connect: [{ id: tenantId }, { id: listing.ownerId }],
        },
      },
      include: { participants: true },
    });
  }

  async sendMessage(roomId: string, senderId: string, content: string, replyToId?: string) {
    await this.assertParticipant(roomId, senderId);
    if (replyToId) {
      const replyMsg = await this.prisma.message.findUnique({ where: { id: replyToId } });
      if (!replyMsg || replyMsg.roomId !== roomId)
        throw new BadRequestException('Invalid reference message');
    }
    const message = await this.prisma.message.create({
      data: { roomId, senderId, content, ...(replyToId ? { replyToId } : {}) },
      include: {
        sender:  { select: SENDER_SELECT },
        replyTo: { select: REPLY_TO_SELECT },
      },
    });
    void this.pusher.trigger('room-' + roomId, 'new-message', {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      content: message.content,
      readAt: message.readAt,
      createdAt: message.createdAt.toISOString(),
    });
    const room = await this.prisma.messageRoom.findUnique({
      where: { id: roomId },
      include: { participants: { select: { id: true } } },
    });
    if (room) {
      const recipients = room.participants
        .filter((p) => p.id !== senderId)
        .map((p) => p.id);
      const senderName =
        message.sender.firstName + ' ' + message.sender.lastName;
      for (const recipientId of recipients) {
        void this.notifications.notifyNewMessage(
          recipientId,
          senderName,
          roomId,
        );
      }
    }
    return message;
  }

  async markRead(roomId: string, userId: string): Promise<{ count: number }> {
    await this.assertParticipant(roomId, userId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: { count: number } = await this.prisma.message.updateMany({
      where: { roomId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return result;
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Not authorized');
    if (msg.deletedAt) throw new BadRequestException('Message deleted');
    if (msg.content.startsWith('[AUDIO]:'))
      throw new BadRequestException('Voice messages cannot be edited');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: { sender: { select: SENDER_SELECT } },
    });
    void this.pusher.trigger('room-' + msg.roomId, 'message-edited', {
      id: updated.id,
      content: updated.content,
      editedAt: updated.editedAt?.toISOString(),
    });
    return updated;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Not authorized');

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    void this.pusher.trigger('room-' + msg.roomId, 'message-deleted', { id: messageId });
    return { success: true };
  }

  private async assertParticipant(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const room = await this.prisma.messageRoom.findUnique({
      where: { id: roomId },
      include: { participants: { select: { id: true } } },
    });
    if (!room) {
      throw new NotFoundException('Conversation not found');
    }
    const isParticipant = room.participants.some((p) => p.id === userId);
    if (!isParticipant) {
      throw new ForbiddenException('Access denied');
    }
  }
}
