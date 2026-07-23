import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP non configuré — emails désactivés');
    }
  }

  async sendCredentials(opts: {
    to: string;
    firstName: string;
    role: 'agent' | 'agence';
    password: string;
    agencyName?: string;
  }): Promise<void> {
    if (!this.transporter) return;

    const from = this.config.get<string>('SMTP_FROM') ?? 'AlloAppart <noreply@alloappart.sn>';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://alloappart.sn';
    const roleLabel = opts.role === 'agent' ? 'Agent terrain' : 'Agence PRO';
    const subject = `Vos identifiants AlloAppart — ${roleLabel}`;

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <img src="${frontendUrl}/images/LOGO.png" alt="AlloAppart" style="height:40px;margin-bottom:24px;" />
        <h2 style="margin:0 0 8px;color:#1a1a1a;">Bienvenue sur AlloAppart, ${opts.firstName}&nbsp;!</h2>
        <p style="color:#555;margin:0 0 24px;">Votre compte <strong>${roleLabel}</strong>${opts.agencyName ? ` (${opts.agencyName})` : ''} a été créé par l'administrateur.</p>
        <div style="background:#f9f6ef;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#888;">Vos identifiants de connexion</p>
          <p style="margin:0 0 4px;font-size:15px;"><strong>Email :</strong> ${opts.to}</p>
          <p style="margin:0;font-size:15px;"><strong>Mot de passe :</strong> <code style="background:#e8e0d0;padding:2px 8px;border-radius:6px;font-size:14px;">${opts.password}</code></p>
        </div>
        <p style="color:#555;margin:0 0 16px;">Connectez-vous et changez votre mot de passe dès votre première connexion.</p>
        <a href="${frontendUrl}/sign-in" style="display:inline-block;background:#c9a84c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;">Se connecter</a>
        <p style="margin-top:32px;font-size:12px;color:#aaa;">Si vous n'êtes pas concerné, ignorez cet email.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({ from, to: opts.to, subject, html });
      this.logger.log(`Credentials email envoyé → ${opts.to}`);
    } catch (err) {
      this.logger.warn(`Échec envoi email → ${opts.to} : ${String(err)}`);
    }
  }

  async sendAccountSuspended(opts: { to: string; firstName: string }): Promise<void> {
    if (!this.transporter) return;
    const from = this.config.get<string>('SMTP_FROM') ?? 'AlloAppart <noreply@alloappart.sn>';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://alloappart.sn';
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <img src="${frontendUrl}/images/LOGO.png" alt="AlloAppart" style="height:40px;margin-bottom:24px;" />
        <h2 style="margin:0 0 8px;color:#1a1a1a;">Votre compte a été suspendu</h2>
        <p style="color:#555;margin:0 0 16px;">Bonjour ${opts.firstName},</p>
        <p style="color:#555;margin:0 0 24px;">Votre compte AlloAppart a été suspendu par l'administrateur. Vous ne pouvez plus accéder à la plateforme.</p>
        <p style="color:#555;margin:0;">Si vous pensez qu'il s'agit d'une erreur, contactez-nous à <a href="mailto:alloappart221@gmail.com" style="color:#c9a84c;">alloappart221@gmail.com</a>.</p>
        <p style="margin-top:32px;font-size:12px;color:#aaa;">L'équipe AlloAppart</p>
      </div>
    `;
    try {
      await this.transporter.sendMail({ from, to: opts.to, subject: 'Votre compte AlloAppart a été suspendu', html });
      this.logger.log(`Suspension email envoyé → ${opts.to}`);
    } catch (err) {
      this.logger.warn(`Échec envoi suspension → ${opts.to} : ${String(err)}`);
    }
  }

  async sendAccountReactivated(opts: { to: string; firstName: string }): Promise<void> {
    if (!this.transporter) return;
    const from = this.config.get<string>('SMTP_FROM') ?? 'AlloAppart <noreply@alloappart.sn>';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://alloappart.sn';
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <img src="${frontendUrl}/images/LOGO.png" alt="AlloAppart" style="height:40px;margin-bottom:24px;" />
        <h2 style="margin:0 0 8px;color:#1a1a1a;">Votre compte a été réactivé</h2>
        <p style="color:#555;margin:0 0 16px;">Bonjour ${opts.firstName},</p>
        <p style="color:#555;margin:0 0 24px;">Bonne nouvelle ! Votre compte AlloAppart a été réactivé. Vous pouvez à nouveau vous connecter et utiliser la plateforme.</p>
        <a href="${frontendUrl}/sign-in" style="display:inline-block;background:#c9a84c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;">Se connecter</a>
        <p style="margin-top:32px;font-size:12px;color:#aaa;">L'équipe AlloAppart</p>
      </div>
    `;
    try {
      await this.transporter.sendMail({ from, to: opts.to, subject: 'Votre compte AlloAppart a été réactivé', html });
      this.logger.log(`Réactivation email envoyé → ${opts.to}`);
    } catch (err) {
      this.logger.warn(`Échec envoi réactivation → ${opts.to} : ${String(err)}`);
    }
  }
}
