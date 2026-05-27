import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findRooms(userId: string) {
    return this.prisma.messageRoom.findMany({
      where: { participants: { some: { id: userId } } },
      include: {
        listing: { select: { id: true, title: true, images: true } },
        participants: { select: { id: true, firstName: true, lastName: true } },
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
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
  }

  async createRoom(listingId: string, tenantId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Annonce introuvable');
    if (listing.ownerId === tenantId)
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer un message à vous-même',
      );

    // Une seule room par couple locataire-bailleur-listing
    const existing = await this.prisma.messageRoom.findFirst({
      where: {
        listingId,
        participants: { some: { id: tenantId } },
      },
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

  async sendMessage(roomId: string, senderId: string, content: string) {
    await this.assertParticipant(roomId, senderId);

    return this.prisma.message.create({
      data: { roomId, senderId, content },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async markRead(roomId: string, userId: string) {
    await this.assertParticipant(roomId, userId);

    return this.prisma.message.updateMany({
      where: { roomId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async assertParticipant(roomId: string, userId: string) {
    const room = await this.prisma.messageRoom.findUnique({
      where: { id: roomId },
      include: { participants: { select: { id: true } } },
    });

    if (!room) throw new NotFoundException('Conversation introuvable');

    const isParticipant = room.participants.some((p) => p.id === userId);
    if (!isParticipant) throw new ForbiddenException('Accès non autorisé');
  }
}
