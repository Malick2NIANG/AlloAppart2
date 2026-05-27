import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
  landlordEmail: string;
  landlordName: string;
  listingTitle: string;
  listingCity: string;
  bookingId: string;
  totalAmount: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
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
      this.logger.warn(
        `Notification skipped (SMTP_USER non configuré) → ${subject}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Email envoyé → ${to} : ${subject}`);
    } catch (err) {
      this.logger.error(
        `Erreur envoi email → ${to} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async notifyBookingCreated(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const city = escapeHtml(data.listingCity);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref = escapeHtml(data.bookingId);

    await this.send(
      data.tenantEmail,
      `Votre demande de réservation — ${data.listingTitle}`,
      `
        <h2>Bonjour ${tenant},</h2>
        <p>Votre demande de réservation pour <strong>${title}</strong> à <strong>${city}</strong> a bien été reçue.</p>
        <p>Montant total : <strong>${data.totalAmount.toLocaleString('fr-SN')} FCFA</strong></p>
        <p>Référence : <code>${ref}</code></p>
        <p>Le bailleur vous contactera prochainement pour confirmer.</p>
        <p>L'équipe Allo-Appart</p>
      `,
    );

    await this.send(
      data.landlordEmail,
      `Nouvelle demande de réservation — ${data.listingTitle}`,
      `
        <h2>Bonjour ${landlord},</h2>
        <p><strong>${tenant}</strong> a effectué une demande de réservation pour votre annonce <strong>${title}</strong>.</p>
        <p>Montant : <strong>${data.totalAmount.toLocaleString('fr-SN')} FCFA</strong></p>
        <p>Connectez-vous à votre espace bailleur pour confirmer ou refuser cette demande.</p>
        <p>L'équipe Allo-Appart</p>
      `,
    );
  }

  async notifyBookingConfirmed(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const city = escapeHtml(data.listingCity);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    await this.send(
      data.tenantEmail,
      `Réservation confirmée — ${data.listingTitle}`,
      `
        <h2>Bonne nouvelle, ${tenant} !</h2>
        <p>Votre réservation pour <strong>${title}</strong> à <strong>${city}</strong> a été <strong>confirmée</strong> par le bailleur.</p>
        <p>Référence : <code>${ref}</code></p>
        <p>L'équipe Allo-Appart</p>
      `,
    );
  }

  async notifyBookingCancelled(
    data: Pick<
      BookingNotificationData,
      'tenantEmail' | 'tenantName' | 'listingTitle' | 'bookingId'
    >,
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    await this.send(
      data.tenantEmail,
      `Réservation annulée — ${data.listingTitle}`,
      `
        <h2>Bonjour ${tenant},</h2>
        <p>Votre réservation pour <strong>${title}</strong> a été annulée.</p>
        <p>Référence : <code>${ref}</code></p>
        <p>Si vous avez des questions, contactez-nous via la messagerie.</p>
        <p>L'équipe Allo-Appart</p>
      `,
    );
  }
}
