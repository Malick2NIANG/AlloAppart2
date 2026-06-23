import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

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
  }): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'alloappart.sn';
    const roleLabel   = opts.role === 'agent' ? 'Agent terrain' : 'Agence PRO';
    const body =
      `AlloAppart — Bonjour ${opts.firstName} !\n` +
      `Votre compte ${roleLabel} a ete cree.\n` +
      `Email : ${opts.email}\n` +
      `Mot de passe : ${opts.password}\n` +
      `Connexion : ${frontendUrl}/sign-in`;

    await this.send(opts.to, body);
  }

  // ── Réservation confirmée (locataire) ────────────────────────────────────
  async sendBookingConfirmed(opts: {
    to: string;
    firstName: string;
    listingTitle: string;
  }): Promise<void> {
    const body =
      `AlloAppart — Bonjour ${opts.firstName} !\n` +
      `Votre réservation pour "${opts.listingTitle}" a ete confirmee par le bailleur.\n` +
      `Bonne installation !`;
    await this.send(opts.to, body);
  }

  // ── Réservation annulée (locataire) ─────────────────────────────────────
  async sendBookingCancelled(opts: {
    to: string;
    firstName: string;
    listingTitle: string;
  }): Promise<void> {
    const body =
      `AlloAppart — Bonjour ${opts.firstName},\n` +
      `Votre réservation pour "${opts.listingTitle}" a ete annulee.\n` +
      `Consultez nos autres annonces sur alloappart.sn`;
    await this.send(opts.to, body);
  }

  // ── Nouvelle demande de réservation (bailleur) ───────────────────────────
  async sendBookingRequest(opts: {
    to: string;
    firstName: string;
    listingTitle: string;
    tenantName: string;
  }): Promise<void> {
    const body =
      `AlloAppart — Bonjour ${opts.firstName},\n` +
      `${opts.tenantName} a fait une demande de réservation pour "${opts.listingTitle}".\n` +
      `Connectez-vous pour accepter ou refuser.`;
    await this.send(opts.to, body);
  }

  // ── Alerte abonnement expirant (PRO_AGENCE) ──────────────────────────────
  async sendSubscriptionExpiring(opts: {
    to: string;
    firstName: string;
    daysLeft: number;
  }): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'alloappart.sn';
    const body =
      `AlloAppart — Bonjour ${opts.firstName},\n` +
      `Votre abonnement PRO expire dans ${opts.daysLeft} jour${opts.daysLeft > 1 ? 's' : ''}.\n` +
      `Renouvelez-le ici : ${frontendUrl}/bailleur/abonnement`;
    await this.send(opts.to, body);
  }

  // ── Abonnement suspendu (PRO_AGENCE) ─────────────────────────────────────
  async sendSubscriptionSuspended(opts: {
    to: string;
    firstName: string;
  }): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'alloappart.sn';
    const body =
      `AlloAppart — Bonjour ${opts.firstName},\n` +
      `Votre abonnement PRO est arrivé à expiration et a ete suspendu.\n` +
      `Renouvelez-le : ${frontendUrl}/bailleur/abonnement`;
    await this.send(opts.to, body);
  }
}
