import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Role } from '@prisma/client';
import { OnesignalService } from '../onesignal/onesignal.service';
import { PrismaService } from '../prisma/prisma.service';
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
    }
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
