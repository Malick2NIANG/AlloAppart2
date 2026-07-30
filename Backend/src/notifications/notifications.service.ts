import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Prisma, Role } from '@prisma/client';
import { OnesignalService } from '../onesignal/onesignal.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import type { BroadcastSegment } from './dto/broadcast.dto';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export interface BookingNotificationData {
  tenantEmail: string;
  tenantName: string;
  tenantId?: string;
  landlordEmail: string;
  landlordName: string;
  landlordId?: string;
  listingTitle: string;
  listingCity: string;
  bookingId: string;
  totalAmount: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly config: ConfigService,
    private readonly onesignal: OnesignalService,
    private readonly prisma: PrismaService,
    private readonly pusher: PusherService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'smtp.gmail.com',
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  private get from(): string {
    return (
      this.config.get<string>('SMTP_FROM') ??
      'Allo-Appart <noreply@alloappart.sn>'
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.config.get<string>('SMTP_USER')) {
      this.logger.warn('Notification skipped (SMTP non configure)');
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log('Email envoye a ' + to);
    } catch (err) {
      this.logger.error(
        'Erreur email : ' + (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  async notifyPaymentConfirmed(data: BookingNotificationData & { platformFee: number; landlordAmount: number }): Promise<void> {
    const title    = escapeHtml(data.listingTitle);
    const tenant   = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref      = escapeHtml(data.bookingId);
    const total    = data.totalAmount.toLocaleString('fr-SN');
    const net      = data.landlordAmount.toLocaleString('fr-SN');
    const fee      = data.platformFee.toLocaleString('fr-SN');

    await this.send(
      data.tenantEmail,
      'Paiement confirmé — ' + data.listingTitle,
      '<h2>Bonjour ' + tenant + ',</h2>' +
      '<p>Votre paiement de <strong>' + total + ' FCFA</strong> a été reçu avec succès.</p>' +
      '<p>Votre réservation pour <strong>' + title + '</strong> est confirmée.</p>' +
      '<p>Référence : <code>' + ref + '</code></p>' +
      "<p>L'équipe Allo-Appart</p>",
    );

    await this.send(
      data.landlordEmail,
      'Nouvelle réservation payée — ' + data.listingTitle,
      '<h2>Bonjour ' + landlord + ',</h2>' +
      '<p><strong>' + tenant + '</strong> a payé et réservé votre logement <strong>' + title + '</strong>.</p>' +
      '<p>Montant total : <strong>' + total + ' FCFA</strong></p>' +
      '<p>Commission AlloAppart : ' + fee + ' FCFA</p>' +
      '<p>Votre part nette : <strong>' + net + ' FCFA</strong></p>' +
      '<p>Les fonds sont sécurisés. Vous les recevrez à la fin du séjour.</p>' +
      "<p>L'équipe Allo-Appart</p>",
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'PAYMENT_CONFIRMED',
        'Paiement confirmé !',
        `Votre réservation pour « ${data.listingTitle} » est confirmée.`,
        { bookingId: data.bookingId },
      );
    }

    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'PAYMENT_RECEIVED',
        'Réservation payée !',
        `${data.tenantName} a payé pour « ${data.listingTitle} ».`,
        { bookingId: data.bookingId },
      );
    }
  }

  async notifyBookingCreated(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const city = escapeHtml(data.listingCity);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref = escapeHtml(data.bookingId);
    const amount = data.totalAmount.toLocaleString('fr-SN');

    await this.send(
      data.tenantEmail,
      'Votre demande de reservation — ' + data.listingTitle,
      '<h2>Bonjour ' +
        tenant +
        ',</h2>' +
        '<p>Votre demande pour <strong>' +
        title +
        '</strong>' +
        ' a <strong>' +
        city +
        '</strong> a ete recue.</p>' +
        '<p>Montant : <strong>' +
        amount +
        ' FCFA</strong></p>' +
        '<p>Ref : <code>' +
        ref +
        '</code></p>' +
        "<p>L'equipe Allo-Appart</p>",
    );

    await this.send(
      data.landlordEmail,
      'Nouvelle demande de reservation — ' + data.listingTitle,
      '<h2>Bonjour ' +
        landlord +
        ',</h2>' +
        '<p><strong>' +
        tenant +
        '</strong> a fait une demande pour' +
        ' <strong>' +
        title +
        '</strong>.</p>' +
        '<p>Montant : <strong>' +
        amount +
        ' FCFA</strong></p>' +
        '<p>Connectez-vous a votre espace bailleur pour repondre.</p>' +
        "<p>L'equipe Allo-Appart</p>",
    );

    const ids = [data.tenantId, data.landlordId].filter(Boolean) as string[];
    if (ids.length) {
      void this.onesignal.sendToExternalIds(
        ids,
        'Nouvelle demande de reservation',
        tenant + ' — ' + data.listingTitle,
        { bookingId: data.bookingId },
      );
    }

    // In-app : bailleur reçoit une alerte immédiate
    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'NEW_BOOKING',
        'Nouvelle demande de réservation',
        `${data.tenantName} a demandé « ${data.listingTitle} ».`,
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  async notifyBookingConfirmed(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const city = escapeHtml(data.listingCity);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    await this.send(
      data.tenantEmail,
      'Reservation confirmee — ' + data.listingTitle,
      '<h2>Bonne nouvelle, ' +
        tenant +
        ' !</h2>' +
        '<p>Votre reservation pour <strong>' +
        title +
        '</strong>' +
        ' a <strong>' +
        city +
        '</strong> est <strong>confirmee</strong>.</p>' +
        '<p>Ref : <code>' +
        ref +
        '</code></p>' +
        "<p>L'equipe Allo-Appart</p>",
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        'Reservation confirmee !',
        'Votre reservation pour ' + data.listingTitle + ' est confirmee.',
        { bookingId: data.bookingId },
      );

      // In-app : locataire apprend la confirmation
      void this.pushInApp(
        data.tenantId,
        'BOOKING_CONFIRMED',
        'Réservation confirmée !',
        `Votre réservation pour « ${data.listingTitle} » est confirmée.`,
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  async notifyBookingCancelled(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    await this.send(
      data.tenantEmail,
      'Reservation annulee — ' + data.listingTitle,
      '<h2>Bonjour ' +
        tenant +
        ',</h2>' +
        '<p>Votre reservation pour <strong>' +
        title +
        '</strong>' +
        ' a ete <strong>annulee</strong>.</p>' +
        '<p>Ref : <code>' +
        ref +
        '</code></p>' +
        '<p>Contact : alloappart221@gmail.com</p>' +
        "<p>L'equipe Allo-Appart</p>",
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        'Reservation annulee',
        'Votre reservation pour ' + data.listingTitle + ' a ete annulee.',
        { bookingId: data.bookingId },
      );

      // In-app : locataire notifié de l'annulation
      void this.pushInApp(
        data.tenantId,
        'BOOKING_CANCELLED',
        'Réservation annulée',
        `Votre réservation pour « ${data.listingTitle} » a été annulée.`,
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }

    // In-app : bailleur notifié si c'est le locataire qui annule
    if (data.landlordId && data.tenantId) {
      void this.pushInApp(
        data.landlordId,
        'BOOKING_CANCELLED',
        'Réservation annulée par le locataire',
        `${data.tenantName} a annulé sa réservation pour « ${data.listingTitle} ».`,
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  // Bailleur : un locataire vient de laisser un avis sur son annonce
  async notifyReviewReceived(
    landlordId: string,
    tenantName: string,
    listingTitle: string,
    rating: number,
    listingId: string,
  ) {
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    await this.pushInApp(
      landlordId,
      'REVIEW_RECEIVED',
      'Nouvel avis reçu',
      `${tenantName} a laissé ${stars} sur « ${listingTitle} ».`,
      { listingId, listingTitle, rating },
    );
  }

  notifyNewMessage(
    recipientId: string,
    senderName: string,
    roomId: string,
  ): void {
    void this.onesignal.sendToExternalIds(
      [recipientId],
      'Nouveau message',
      senderName + ' vous a envoye un message.',
      { roomId },
    );
  }

  /* ── In-app notifications (DB + Pusher) ─────────────────────────────── */

  private async pushInApp(
    userId: string,
    type: string,
    title: string,
    body: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const notif = await this.prisma.notification.create({
      data: { userId, type, title, body, metadata },
    });
    void this.pusher.trigger(`user-${userId}`, 'notification', notif);
    return notif;
  }

  // Agent : nouvelle mission assignée
  async notifyVerifAssigned(
    agentId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(
      agentId,
      'VERIF_ASSIGNED',
      'Nouvelle mission AlloVérifié',
      `Vous avez été assigné à la vérification de « ${listingTitle} ».`,
      { verificationId, listingTitle, listingId },
    );
  }

  // Bailleur : agent assigné (SCHEDULED)
  async notifyVerifScheduled(
    bailleurId: string,
    listingTitle: string,
    agentName: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(
      bailleurId,
      'VERIF_SCHEDULED',
      'Agent assigné à votre vérification',
      `${agentName} a été assigné pour vérifier « ${listingTitle} ».`,
      { verificationId, listingTitle, listingId },
    );
  }

  // Bailleur : visite en cours (IN_PROGRESS)
  async notifyVerifInProgress(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(
      bailleurId,
      'VERIF_IN_PROGRESS',
      'Visite AlloVérifié en cours',
      `La vérification de « ${listingTitle} » a démarré.`,
      { verificationId, listingTitle, listingId },
    );
  }

  // Bailleur : mission terminée (DONE)
  async notifyVerifDone(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(
      bailleurId,
      'VERIF_DONE',
      '✅ Vérification terminée !',
      `La visite de « ${listingTitle} » est terminée. En attente de validation admin.`,
      { verificationId, listingTitle, listingId },
    );
  }

  // Agent : mission déclinée par lui-même (remise en REQUESTED)
  async notifyVerifDeclined(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(
      bailleurId,
      'VERIF_DECLINED',
      'Agent indisponible pour votre mission',
      `L'agent a décliné la mission pour « ${listingTitle} ». Un autre agent sera assigné.`,
      { verificationId, listingTitle, listingId },
    );
  }

  // Admin : nouveau signalement d'annonce
  async notifyAdminReport(
    listingId: string,
    listingTitle: string,
    reporterName: string,
    reason: string,
    reportCount: number,
  ) {
    const REASON_LABELS: Record<string, string> = {
      FRAUD:          'Arnaque / fraude',
      WRONG_PRICE:    'Prix trompeur',
      WRONG_PHOTOS:   'Photos trompeuses',
      ALREADY_RENTED: 'Bien déjà loué',
      WRONG_LOCATION: 'Localisation incorrecte',
      OFFENSIVE:      'Contenu offensant',
      OTHER:          'Autre',
    };
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    const label  = REASON_LABELS[reason] ?? reason;
    const urgent = reportCount >= 3;
    await Promise.all(admins.map((admin) =>
      this.pushInApp(
        admin.id,
        'LISTING_REPORTED',
        urgent ? '🚨 Annonce signalée plusieurs fois' : 'Nouvelle signalisation d\'annonce',
        `« ${listingTitle} » signalée par ${reporterName}. Motif : ${label}. (${reportCount} signalement${reportCount > 1 ? 's' : ''} au total)`,
        { listingId, listingTitle, reportCount },
      ),
    ));
  }

  // Admin : l'agent demande à décliner une mission (en attente approbation)
  async notifyAdminDeclineRequest(
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    // Notifier tous les admins
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    await Promise.all(admins.map((admin) =>
      this.pushInApp(
        admin.id,
        'VERIF_DECLINE_REQUEST',
        'Demande de déclin à approuver',
        `Un agent demande à décliner la mission « ${listingTitle} ». Approbation requise.`,
        { verificationId, listingTitle, listingId },
      )
    ));
  }

  // Bailleur : badge AlloVérifié accordé par l'admin
  async notifyVerifValidated(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(
      bailleurId,
      'VERIF_VALIDATED',
      '🏅 Badge AlloVérifié accordé !',
      `Votre annonce « ${listingTitle} » a obtenu le badge AlloVérifié.`,
      { verificationId, listingTitle, listingId },
    );
  }

  /* ── In-app API (endpoints) ───────────────────────────────────────── */

  async findByUser(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async broadcastPush(
    title: string,
    message: string,
    segment: BroadcastSegment,
  ): Promise<{ sent: boolean; recipients: number }> {
    const roleMap: Record<string, Role> = {
      BAILLEURS:   Role.BAILLEUR,
      LOCATAIRES:  Role.LOCATAIRE,
      PRO_AGENCES: Role.PRO_AGENCE,
    };

    let externalIds: string[] | undefined;
    let recipients: number;

    if (segment === 'ALL') {
      recipients = await this.prisma.user.count();
    } else {
      const role = roleMap[segment];
      const users = await this.prisma.user.findMany({
        where: { roles: { has: role } },
        select: { clerkId: true },
      });
      externalIds = users.map((u) => u.clerkId);
      recipients = externalIds.length;
    }

    await this.onesignal.sendBroadcast(title, message, externalIds);
    this.logger.log(`broadcastPush segment=${segment} recipients=${recipients}`);
    return { sent: true, recipients };
  }
}
