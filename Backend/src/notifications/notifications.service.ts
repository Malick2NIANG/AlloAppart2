import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Prisma, Role } from '@prisma/client';
import { OnesignalService } from '../onesignal/onesignal.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import {
  t,
  toLocale,
  formatNumber,
  reasonLabel,
  DEFAULT_LOCALE,
  type Locale,
  type MessageKey,
} from '../i18n/messages';
import type { BroadcastSegment } from './dto/broadcast.dto';

const SUPPORT_EMAIL = 'alloappart221@gmail.com';

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

  /* ── Résolution de la langue ────────────────────────────────────────────
   * Résolue ici plutôt que passée par les appelants : aucun service métier
   * n'a besoin de connaître la langue, et on évite d'oublier de la propager.
   * Coût : une requête légère par destinataire, négligeable pour ce volume.
   */
  private async localeOf(opts: { userId?: string; email?: string }): Promise<Locale> {
    try {
      const where = opts.userId
        ? { id: opts.userId }
        : opts.email
          ? { email: opts.email }
          : null;
      if (!where) return DEFAULT_LOCALE;

      const user = await this.prisma.user.findUnique({
        where,
        select: { locale: true },
      });
      return toLocale(user?.locale);
    } catch {
      return DEFAULT_LOCALE;
    }
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

  /** Pied de page commun des emails. */
  private signature(loc: Locale): string {
    return `<p>${t(loc, 'commonTeam')}</p>`;
  }

  /* ── Emails transactionnels ─────────────────────────────────────────────── */

  async notifyPaymentConfirmed(
    data: BookingNotificationData & { platformFee: number; landlordAmount: number },
  ): Promise<void> {
    const title    = escapeHtml(data.listingTitle);
    const tenant   = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref      = escapeHtml(data.bookingId);

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    /* Locataire */
    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailPaymentTenantSubject', { listingTitle: data.listingTitle }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
      `<p>${t(tenantLoc, 'mailPaymentTenantAmount', { total: formatNumber(tenantLoc, data.totalAmount) })}</p>` +
      `<p>${t(tenantLoc, 'mailPaymentTenantConfirmed', { listingTitle: title })}</p>` +
      `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
      this.signature(tenantLoc),
    );

    /* Bailleur */
    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailPaymentLandlordSubject', { listingTitle: data.listingTitle }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
      `<p>${t(landlordLoc, 'mailPaymentLandlordBody', { tenantName: tenant, listingTitle: title })}</p>` +
      `<p>${t(landlordLoc, 'mailPaymentTotalLabel', { total: formatNumber(landlordLoc, data.totalAmount) })}</p>` +
      `<p>${t(landlordLoc, 'mailPaymentFeeLabel', { fee: formatNumber(landlordLoc, data.platformFee) })}</p>` +
      `<p>${t(landlordLoc, 'mailPaymentNetLabel', { net: formatNumber(landlordLoc, data.landlordAmount) })}</p>` +
      `<p>${t(landlordLoc, 'mailPaymentEscrowNote')}</p>` +
      this.signature(landlordLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(data.tenantId, 'PAYMENT_CONFIRMED',
        'pushPaymentConfirmedTitle', 'pushPaymentConfirmedBody',
        { listingTitle: data.listingTitle }, { bookingId: data.bookingId });
    }

    if (data.landlordId) {
      void this.pushInApp(data.landlordId, 'PAYMENT_RECEIVED',
        'pushPaymentReceivedTitle', 'pushPaymentReceivedBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
        { bookingId: data.bookingId });
    }
  }

  async notifyBookingCreated(data: BookingNotificationData): Promise<void> {
    const title    = escapeHtml(data.listingTitle);
    const city     = escapeHtml(data.listingCity);
    const tenant   = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref      = escapeHtml(data.bookingId);

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingRequestTenantSubject', { listingTitle: data.listingTitle }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
      `<p>${t(tenantLoc, 'mailBookingRequestTenantBody', { listingTitle: title, city })}</p>` +
      `<p>${t(tenantLoc, 'mailAmountLabel', { amount: formatNumber(tenantLoc, data.totalAmount) })}</p>` +
      `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
      this.signature(tenantLoc),
    );

    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailBookingRequestLandlordSubject', { listingTitle: data.listingTitle }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
      `<p>${t(landlordLoc, 'mailBookingRequestLandlordBody', { tenantName: tenant, listingTitle: title })}</p>` +
      `<p>${t(landlordLoc, 'mailAmountLabel', { amount: formatNumber(landlordLoc, data.totalAmount) })}</p>` +
      `<p>${t(landlordLoc, 'mailBookingRequestLandlordAction')}</p>` +
      this.signature(landlordLoc),
    );

    /* Push OneSignal : un seul texte pour le lot, dans la langue du bailleur
     * (destinataire principal de l'action attendue). */
    const ids = [data.tenantId, data.landlordId].filter(Boolean) as string[];
    if (ids.length) {
      void this.onesignal.sendToExternalIds(
        ids,
        t(landlordLoc, 'pushNewBookingTitle'),
        t(landlordLoc, 'pushBookingRequestOneSignal', {
          tenantName: tenant,
          listingTitle: data.listingTitle,
        }),
        { bookingId: data.bookingId },
      );
    }

    if (data.landlordId) {
      void this.pushInApp(data.landlordId, 'NEW_BOOKING',
        'pushNewBookingTitle', 'pushNewBookingBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle });
    }
  }

  async notifyBookingConfirmed(data: BookingNotificationData): Promise<void> {
    const title  = escapeHtml(data.listingTitle);
    const city   = escapeHtml(data.listingCity);
    const tenant = escapeHtml(data.tenantName);
    const ref    = escapeHtml(data.bookingId);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingConfirmedSubject', { listingTitle: data.listingTitle }),
      `<h2>${t(tenantLoc, 'mailBookingConfirmedTitle', { firstName: tenant })}</h2>` +
      `<p>${t(tenantLoc, 'mailBookingConfirmedBody', { listingTitle: title, city })}</p>` +
      `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
      this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        t(tenantLoc, 'pushBookingConfirmedTitle'),
        t(tenantLoc, 'pushBookingConfirmedBody', { listingTitle: data.listingTitle }),
        { bookingId: data.bookingId },
      );

      void this.pushInApp(data.tenantId, 'BOOKING_CONFIRMED',
        'pushBookingConfirmedTitle', 'pushBookingConfirmedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle });
    }
  }

  async notifyBookingCancelled(data: BookingNotificationData): Promise<void> {
    const title  = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const ref    = escapeHtml(data.bookingId);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingCancelledSubject', { listingTitle: data.listingTitle }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
      `<p>${t(tenantLoc, 'mailBookingCancelledBody', { listingTitle: title })}</p>` +
      `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
      `<p>${t(tenantLoc, 'mailContactLabel', { email: SUPPORT_EMAIL })}</p>` +
      this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        t(tenantLoc, 'pushBookingCancelledTitle'),
        t(tenantLoc, 'pushBookingCancelledBody', { listingTitle: data.listingTitle }),
        { bookingId: data.bookingId },
      );

      void this.pushInApp(data.tenantId, 'BOOKING_CANCELLED',
        'pushBookingCancelledTitle', 'pushBookingCancelledBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle });
    }

    /* Bailleur notifié si c'est le locataire qui annule */
    if (data.landlordId && data.tenantId) {
      void this.pushInApp(data.landlordId, 'BOOKING_CANCELLED',
        'pushBookingCancelledByTenantTitle', 'pushBookingCancelledByTenantBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle });
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
    await this.pushInApp(landlordId, 'REVIEW_RECEIVED',
      'pushReviewReceivedTitle', 'pushReviewReceivedBody',
      { tenantName, stars, listingTitle },
      { listingId, listingTitle, rating });
  }

  notifyNewMessage(
    recipientId: string,
    senderName: string,
    roomId: string,
  ): void {
    /* Fire-and-forget : on résout la langue puis on pousse. */
    void this.localeOf({ userId: recipientId }).then((loc) =>
      this.onesignal.sendToExternalIds(
        [recipientId],
        t(loc, 'pushNewMessageTitle'),
        t(loc, 'pushNewMessageBody', { senderName }),
        { roomId },
      ),
    );
  }

  /* ── In-app notifications (DB + Pusher) ─────────────────────────────────
   * Le titre et le corps sont traduits à l'écriture, dans la langue du
   * destinataire au moment de l'événement, puis stockés tels quels en base.
   * Conséquence assumée : une notification déjà créée ne change pas de langue
   * si l'utilisateur bascule ensuite. Stocker clé + paramètres imposerait de
   * modifier le modèle Notification et la page frontend — chantier séparé.
   */
  private async pushInApp(
    userId: string,
    type: string,
    titleKey: MessageKey,
    bodyKey: MessageKey,
    params: Record<string, string | number> = {},
    metadata?: Prisma.InputJsonValue,
  ) {
    const loc = await this.localeOf({ userId });
    const notif = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: t(loc, titleKey, params),
        body: t(loc, bodyKey, params),
        metadata,
      },
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
    await this.pushInApp(agentId, 'VERIF_ASSIGNED',
      'pushVerifAssignedTitle', 'pushVerifAssignedBody',
      { listingTitle }, { verificationId, listingTitle, listingId });
  }

  // Bailleur : agent assigné (SCHEDULED)
  async notifyVerifScheduled(
    bailleurId: string,
    listingTitle: string,
    agentName: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(bailleurId, 'VERIF_SCHEDULED',
      'pushVerifScheduledTitle', 'pushVerifScheduledBody',
      { agentName, listingTitle }, { verificationId, listingTitle, listingId });
  }

  // Bailleur : visite en cours (IN_PROGRESS)
  async notifyVerifInProgress(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(bailleurId, 'VERIF_IN_PROGRESS',
      'pushVerifInProgressTitle', 'pushVerifInProgressBody',
      { listingTitle }, { verificationId, listingTitle, listingId });
  }

  // Bailleur : mission terminée (DONE)
  async notifyVerifDone(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(bailleurId, 'VERIF_DONE',
      'pushVerifDoneTitle', 'pushVerifDoneBody',
      { listingTitle }, { verificationId, listingTitle, listingId });
  }

  // Agent : mission déclinée par lui-même (remise en REQUESTED)
  async notifyVerifDeclined(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(bailleurId, 'VERIF_DECLINED',
      'pushVerifDeclinedTitle', 'pushVerifDeclinedBody',
      { listingTitle }, { verificationId, listingTitle, listingId });
  }

  // Admin : nouveau signalement d'annonce
  async notifyAdminReport(
    listingId: string,
    listingTitle: string,
    reporterName: string,
    reason: string,
    reportCount: number,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true, locale: true },
    });
    const urgent = reportCount >= 3;

    await Promise.all(admins.map((admin) => {
      const loc = toLocale(admin.locale);
      return this.prisma.notification
        .create({
          data: {
            userId: admin.id,
            type: 'LISTING_REPORTED',
            title: t(loc, urgent
              ? 'pushListingReportedUrgentTitle'
              : 'pushListingReportedTitle'),
            body: t(loc, 'pushListingReportedBody', {
              listingTitle,
              reporterName,
              reason: reasonLabel(loc, reason),
              count: reportCount,
            }),
            metadata: { listingId, listingTitle, reportCount },
          },
        })
        .then((notif) => {
          void this.pusher.trigger(`user-${admin.id}`, 'notification', notif);
        });
    }));
  }

  // Admin : l'agent demande à décliner une mission (en attente approbation)
  async notifyAdminDeclineRequest(
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    await Promise.all(admins.map((admin) =>
      this.pushInApp(admin.id, 'VERIF_DECLINE_REQUEST',
        'pushDeclineRequestTitle', 'pushDeclineRequestBody',
        { listingTitle }, { verificationId, listingTitle, listingId }),
    ));
  }

  // Signalement de non-conformité (Article 9 des CGU) — notifie le bailleur
  // concerné et tous les admins pour arbitrage.
  async notifyDisputeReported(
    landlordId: string,
    listingTitle: string,
    bookingId: string,
    listingId: string,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    await Promise.all([
      this.pushInApp(landlordId, 'BOOKING_DISPUTED',
        'pushDisputeReportedLandlordTitle', 'pushDisputeReportedLandlordBody',
        { listingTitle }, { bookingId, listingTitle, listingId }),
      ...admins.map((admin) =>
        this.pushInApp(admin.id, 'BOOKING_DISPUTED',
          'pushDisputeReportedAdminTitle', 'pushDisputeReportedAdminBody',
          { listingTitle }, { bookingId, listingTitle, listingId }),
      ),
    ]);
  }

  // Résolution d'un litige par un admin — notifie locataire et bailleur.
  async notifyDisputeResolved(
    tenantId: string,
    landlordId: string,
    listingTitle: string,
    bookingId: string,
    listingId: string,
    decision: 'RELEASE' | 'REFUND',
  ) {
    const released = decision === 'RELEASE';
    await Promise.all([
      this.pushInApp(tenantId, 'DISPUTE_RESOLVED',
        released ? 'pushDisputeResolvedReleaseTenantTitle' : 'pushDisputeResolvedRefundTenantTitle',
        released ? 'pushDisputeResolvedReleaseTenantBody' : 'pushDisputeResolvedRefundTenantBody',
        { listingTitle }, { bookingId, listingTitle, listingId }),
      this.pushInApp(landlordId, 'DISPUTE_RESOLVED',
        released ? 'pushDisputeResolvedReleaseLandlordTitle' : 'pushDisputeResolvedRefundLandlordTitle',
        released ? 'pushDisputeResolvedReleaseLandlordBody' : 'pushDisputeResolvedRefundLandlordBody',
        { listingTitle }, { bookingId, listingTitle, listingId }),
    ]);
  }

  // Bailleur : badge AlloVérifié accordé par l'admin
  async notifyVerifValidated(
    bailleurId: string,
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    await this.pushInApp(bailleurId, 'VERIF_VALIDATED',
      'pushVerifValidatedTitle', 'pushVerifValidatedBody',
      { listingTitle }, { verificationId, listingTitle, listingId });
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

  /* Broadcast admin : le titre et le message sont saisis à la main par
   * l'administrateur, donc envoyés tels quels sans traduction. */
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
