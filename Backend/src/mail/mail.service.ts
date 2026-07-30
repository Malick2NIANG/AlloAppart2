import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { t, toLocale, type Locale } from '../i18n/messages';

const SUPPORT_EMAIL = 'alloappart221@gmail.com';

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

  private get from(): string {
    return (
      this.config.get<string>('SMTP_FROM') ??
      'AlloAppart <noreply@alloappart.sn>'
    );
  }

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'https://alloappart.sn';
  }

  /** Enveloppe HTML commune : logo + conteneur. */
  private shell(inner: string): string {
    return `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <img src="${this.frontendUrl}/images/LOGO.png" alt="AlloAppart" style="height:40px;margin-bottom:24px;" />
        ${inner}
      </div>
    `;
  }

  private button(label: string, href: string): string {
    return `<a href="${href}" style="display:inline-block;background:#c9a84c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;">${label}</a>`;
  }

  private async deliver(to: string, subject: string, html: string, tag: string): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`${tag} envoyé → ${to}`);
    } catch (err) {
      this.logger.warn(`Échec envoi ${tag} → ${to} : ${String(err)}`);
    }
  }

  async sendCredentials(opts: {
    to: string;
    firstName: string;
    role: 'agent' | 'agence';
    password: string;
    agencyName?: string;
    locale?: string | null;
  }): Promise<void> {
    if (!this.transporter) return;

    const loc: Locale = toLocale(opts.locale);
    const roleLabel = t(loc, opts.role === 'agent' ? 'roleAgent' : 'roleAgence');
    const agencySuffix = opts.agencyName ? ` (${opts.agencyName})` : '';

    const html = this.shell(`
      <h2 style="margin:0 0 8px;color:#1a1a1a;">${t(loc, 'mailCredentialsTitle', { firstName: opts.firstName })}</h2>
      <p style="color:#555;margin:0 0 24px;">${t(loc, 'mailCredentialsIntro', { roleLabel, agencySuffix })}</p>
      <div style="background:#f9f6ef;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#888;">${t(loc, 'mailCredentialsBoxTitle')}</p>
        <p style="margin:0 0 4px;font-size:15px;"><strong>${t(loc, 'mailCredentialsEmailLabel')}</strong> ${opts.to}</p>
        <p style="margin:0;font-size:15px;"><strong>${t(loc, 'mailCredentialsPasswordLabel')}</strong> <code style="background:#e8e0d0;padding:2px 8px;border-radius:6px;font-size:14px;">${opts.password}</code></p>
      </div>
      <p style="color:#555;margin:0 0 16px;">${t(loc, 'mailCredentialsAdvice')}</p>
      ${this.button(t(loc, 'commonSignIn'), `${this.frontendUrl}/sign-in`)}
      <p style="margin-top:32px;font-size:12px;color:#aaa;">${t(loc, 'mailCredentialsIgnore')}</p>
    `);

    await this.deliver(
      opts.to,
      t(loc, 'mailCredentialsSubject', { roleLabel }),
      html,
      'Credentials email',
    );
  }

  async sendAccountSuspended(opts: {
    to: string;
    firstName: string;
    locale?: string | null;
  }): Promise<void> {
    if (!this.transporter) return;
    const loc: Locale = toLocale(opts.locale);

    const html = this.shell(`
      <h2 style="margin:0 0 8px;color:#1a1a1a;">${t(loc, 'mailSuspendedTitle')}</h2>
      <p style="color:#555;margin:0 0 16px;">${t(loc, 'commonHello', { firstName: opts.firstName })},</p>
      <p style="color:#555;margin:0 0 24px;">${t(loc, 'mailSuspendedBody')}</p>
      <p style="color:#555;margin:0;">${t(loc, 'mailSuspendedContact')} <a href="mailto:${SUPPORT_EMAIL}" style="color:#c9a84c;">${SUPPORT_EMAIL}</a>.</p>
      <p style="margin-top:32px;font-size:12px;color:#aaa;">${t(loc, 'commonTeam')}</p>
    `);

    await this.deliver(opts.to, t(loc, 'mailSuspendedSubject'), html, 'Suspension email');
  }

  async sendAccountReactivated(opts: {
    to: string;
    firstName: string;
    locale?: string | null;
  }): Promise<void> {
    if (!this.transporter) return;
    const loc: Locale = toLocale(opts.locale);

    const html = this.shell(`
      <h2 style="margin:0 0 8px;color:#1a1a1a;">${t(loc, 'mailReactivatedTitle')}</h2>
      <p style="color:#555;margin:0 0 16px;">${t(loc, 'commonHello', { firstName: opts.firstName })},</p>
      <p style="color:#555;margin:0 0 24px;">${t(loc, 'mailReactivatedBody')}</p>
      ${this.button(t(loc, 'commonSignIn'), `${this.frontendUrl}/sign-in`)}
      <p style="margin-top:32px;font-size:12px;color:#aaa;">${t(loc, 'commonTeam')}</p>
    `);

    await this.deliver(opts.to, t(loc, 'mailReactivatedSubject'), html, 'Réactivation email');
  }
}
