import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

const SENDER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  agencyName: true,
  roles: true,
} as const;
const REPLY_TO_SELECT = {
  id: true,
  content: true,
  senderId: true,
  deletedAt: true,
  sender: { select: SENDER_SELECT },
} as const;
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import { NotificationsService } from '../notifications/notifications.service';
import { sanitizeContactInfo } from './contact-filter.util';

// Marqueurs posés par sanitizeContactInfo() sur le contenu stocké — sert à
// recompter, a posteriori, les tentatives de contournement d'un expéditeur
// sans avoir besoin d'une table/colonne dédiée (Task #121).
const CIRCUMVENTION_MARKERS = [
  '[numéro masqué]',
  '[application masquée]',
  '[email masqué]',
];
// Nombre de tentatives filtrées, sur 24h glissantes, à partir duquel les
// admins sont alertés. Renotifié tous les N dépassements supplémentaires
// (pas à chaque message) pour ne pas spammer les admins d'un récidiviste.
const CIRCUMVENTION_ALERT_THRESHOLD = 3;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pusher: PusherService,
    private readonly notifications: NotificationsService,
  ) {}

  async findRooms(userId: string) {
    const rooms = await this.prisma.messageRoom.findMany({
      where: { participants: { some: { id: userId } } },
      include: {
        // ownerId : indispensable côté front pour distinguer, sur un compte
        // dual bailleur+locataire, les rooms où l'utilisateur est propriétaire
        // de l'annonce de celles où il est le locataire qui a engagé la
        // conversation — sinon le badge "non lus" de la sidebar affiche le
        // même total sur les deux entrées "Messages" (cf. décision du 2026-09-24).
        listing: {
          select: { id: true, title: true, images: true, ownerId: true },
        },
        participants: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            agencyName: true,
            agencySlug: true,
            roles: true,
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Statut archivé : migration 20260924140000_add_archived_rooms appliquée
    // et client Prisma régénéré (2026-09-24) — on utilise désormais l'API
    // modèle plutôt que le SQL brut utilisé le temps que la migration soit
    // appliquée en base.
    const archivedRows = await this.prisma.archivedRoom.findMany({
      where: { userId },
      select: { roomId: true },
    });
    const archivedIds = new Set(archivedRows.map((r) => r.roomId));

    return rooms.map((room) => ({
      ...room,
      archived: archivedIds.has(room.id),
    }));
  }

  // Archivage à la WhatsApp : état par utilisateur, indépendant des autres
  // participants de la conversation.
  async archiveRoom(
    roomId: string,
    userId: string,
  ): Promise<{ success: true }> {
    await this.assertParticipant(roomId, userId);
    await this.prisma.archivedRoom.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId },
      update: {},
    });
    return { success: true };
  }

  async unarchiveRoom(
    roomId: string,
    userId: string,
  ): Promise<{ success: true }> {
    await this.assertParticipant(roomId, userId);
    await this.prisma.archivedRoom.deleteMany({
      where: { userId, roomId },
    });
    return { success: true };
  }

  async findMessages(roomId: string, userId: string, page = 1, limit = 50) {
    await this.assertParticipant(roomId, userId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return this.prisma.message.findMany({
      where: { roomId },
      include: {
        sender: { select: SENDER_SELECT },
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

  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    replyToId?: string,
  ) {
    await this.assertParticipant(roomId, senderId);
    if (replyToId) {
      const replyMsg = await this.prisma.message.findUnique({
        where: { id: replyToId },
      });
      if (!replyMsg || replyMsg.roomId !== roomId)
        throw new BadRequestException('Invalid reference message');
    }
    // Les messages vocaux stockent une URL (Cloudinary) dans `content`, jamais
    // du texte libre — on ne les fait pas passer par le filtre anti-contournement
    // pour ne pas masquer par erreur les chiffres de l'URL.
    const isVoice = content.startsWith('[AUDIO]:');
    const filtered = isVoice ? null : sanitizeContactInfo(content);
    const safeContent = isVoice ? content : filtered!.content;
    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content: safeContent,
        ...(replyToId ? { replyToId } : {}),
      },
      include: {
        sender: { select: SENDER_SELECT },
        replyTo: { select: REPLY_TO_SELECT },
      },
    });
    const senderName = message.sender.firstName + ' ' + message.sender.lastName;
    if (filtered?.wasFiltered) {
      void this.logAndMaybeAlertCircumvention(senderId, senderName, roomId);
    }
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

    const result: { count: number } = await this.prisma.message.updateMany({
      where: { roomId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return result;
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Not authorized');
    if (msg.deletedAt) throw new BadRequestException('Message deleted');
    if (msg.content.startsWith('[AUDIO]:'))
      throw new BadRequestException('Voice messages cannot be edited');

    const filtered = sanitizeContactInfo(content);
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: filtered.content, editedAt: new Date() },
      include: { sender: { select: SENDER_SELECT } },
    });
    if (filtered.wasFiltered) {
      const editorName =
        updated.sender.firstName + ' ' + updated.sender.lastName;
      void this.logAndMaybeAlertCircumvention(userId, editorName, msg.roomId);
    }
    void this.pusher.trigger('room-' + msg.roomId, 'message-edited', {
      id: updated.id,
      content: updated.content,
      editedAt: updated.editedAt?.toISOString(),
    });
    return updated;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Not authorized');

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    void this.pusher.trigger('room-' + msg.roomId, 'message-deleted', {
      id: messageId,
    });
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

  // Journalise chaque tentative filtrée (numéro/email/app externe) et, si un
  // même expéditeur en cumule plusieurs sur 24h glissantes, alerte les admins.
  // Recompte directement dans les messages déjà stockés (marqueurs
  // CIRCUMVENTION_MARKERS) — pas de table de compteur dédiée (Task #121).
  private async logAndMaybeAlertCircumvention(
    senderId: string,
    senderName: string,
    roomId: string,
  ): Promise<void> {
    this.logger.warn(
      `Tentative de contournement filtrée — expéditeur=${senderId} conversation=${roomId}`,
    );

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await this.prisma.message.count({
        where: {
          senderId,
          createdAt: { gte: since },
          OR: CIRCUMVENTION_MARKERS.map((marker) => ({
            content: { contains: marker },
          })),
        },
      });

      if (
        count >= CIRCUMVENTION_ALERT_THRESHOLD &&
        count % CIRCUMVENTION_ALERT_THRESHOLD === 0
      ) {
        void this.notifications.notifyContactFilterAlert(
          senderId,
          senderName,
          roomId,
          count,
        );
      }
    } catch (err) {
      // Le comptage/l'alerte ne doit jamais faire échouer l'envoi du message.
      this.logger.error(
        'Échec du contrôle anti-contournement (non bloquant)',
        err as Error,
      );
    }
  }
}
