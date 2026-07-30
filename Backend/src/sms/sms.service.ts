import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { t, toLocale, type Locale } from '../i18n/messages';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: ReturnType<typeof twilio> | null = null;
  private from: string = '';

  constructor(private readonly config: ConfigService) {
    const sid   = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.from   = this.config.get<string>('TWILIO_FROM_NUMBER') ?? '';

    if (sid && token && this.from) {
      this.client = twilio(sid, token);
    } else {
      this.logger.warn('Twilio non configuré — SMS désactivés');
    }
  }

  private get url(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'alloappart.sn';
  }

  // ── Méthode d'envoi générique ────────────────────────────────────────────
  async send(to: string, body: string): Promise<void> {
    if (!this.client || !to) return;
    try {
      await this.client.messages.create({ from: this.from, to, body });
      this.logger.log(`SMS envoyé → ${to}`);
    } catch (err) {
      this.logger.warn(`Échec SMS → ${to} : ${String(err)}`);
    }
  }

  // ── Identifiants agent / agence PRO ─────────────────────────────────────
  async sendCredentials(opts: {
    to: string;
    firstName: string;
    email: string;
    password: string;
    role: 'agent' | 'agence';
    locale?: string | null;
  }): Promise<void> {
    const loc: Locale = toLocale(opts.locale);
    await this.send(
      opts.to,
      t(loc, 'smsCredentials', {
        firstName: opts.firstName,
        roleLabel: t(loc, opts.role === 'agent' ? 'roleAgent' : 'roleAgence'),
        email: opts.email,
        password: opts.password,
        url: this.url,
      }),
    );
  }

  // ── Réservation confirmée (locataire) ────────────────────────────────────
  async sendBookingConfirmed(opts: {
    to: string;
    firstName: string;
    listingTitle: string;
    locale?: string | null;
  }): Promise<void> {
    const loc: Locale = toLocale(opts.locale);
    await this.send(
      opts.to,
      t(loc, 'smsBookingConfirmed', {
        firstName: opts.firstName,
        listingTitle: opts.listingTitle,
      }),
    );
  }

  // ── Réservation annulée (locataire) ─────────────────────────────────────
  async sendBookingCancelled(opts: {
    to: string;
    firstName: string;
    listingTitle: string;
    locale?: string | null;
  }): Promise<void> {
    const loc: Locale = toLocale(opts.locale);
    await this.send(
      opts.to,
      t(loc, 'smsBookingCancelled', {
        firstName: opts.firstName,
        listingTitle: opts.listingTitle,
      }),
    );
  }

  // ── Nouvelle demande de réservation (bailleur) ───────────────────────────
  async sendBookingRequest(opts: {
    to: string;
    firstName: string;
    listingTitle: string;
    tenantName: string;
    locale?: string | null;
  }): Promise<void> {
    const loc: Locale = toLocale(opts.locale);
    await this.send(
      opts.to,
      t(loc, 'smsBookingRequest', {
        firstName: opts.firstName,
        tenantName: opts.tenantName,
        listingTitle: opts.listingTitle,
      }),
    );
  }

  // ── Alerte abonnement expirant (PRO_AGENCE) ──────────────────────────────
  async sendSubscriptionExpiring(opts: {
    to: string;
    firstName: string;
    daysLeft: number;
    locale?: string | null;
  }): Promise<void> {
    const loc: Locale = toLocale(opts.locale);
    await this.send(
      opts.to,
      t(loc, 'smsSubscriptionExpiring', {
        firstName: opts.firstName,
        daysLeft: opts.daysLeft,
        url: this.url,
      }),
    );
  }

  // ── Abonnement suspendu (PRO_AGENCE) ─────────────────────────────────────
  async sendSubscriptionSuspended(opts: {
    to: string;
    firstName: string;
    locale?: string | null;
  }): Promise<void> {
    const loc: Locale = toLocale(opts.locale);
    await this.send(
      opts.to,
      t(loc, 'smsSubscriptionSuspended', {
        firstName: opts.firstName,
        url: this.url,
      }),
    );
  }
}
