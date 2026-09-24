import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { Prisma, Role } from '@prisma/client';
import { OnesignalService } from '../onesignal/onesignal.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../pusher/pusher.service';
import { isPlaceholderEmail } from '../common/user-display.util';
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

/** Champs tarifaires de PlatformConfig pouvant faire l'objet d'une notification. */
export type ConfigFieldKey =
  | 'starterPriceFcfa'
  | 'proPriceFcfaMonthly'
  | 'nightlyCommissionRate'
  | 'monthlyCommissionMonths'
  | 'auditBasicPriceFcfa'
  | 'boostPriceFcfa';

export interface ConfigFieldChange {
  field: ConfigFieldKey;
  oldValue: number;
  newValue: number;
}

const CONFIG_FIELD_LABELS: Record<ConfigFieldKey, MessageKey> = {
  starterPriceFcfa: 'configFieldStarterPrice',
  proPriceFcfaMonthly: 'configFieldProPrice',
  nightlyCommissionRate: 'configFieldNightlyCommission',
  monthlyCommissionMonths: 'configFieldMonthlyCommission',
  auditBasicPriceFcfa: 'configFieldAuditBasic',
  boostPriceFcfa: 'configFieldBoost',
};

/** Champs exprimés en FCFA (les autres ont un format dédié). */
const FCFA_FIELDS: ReadonlySet<ConfigFieldKey> = new Set([
  'starterPriceFcfa',
  'proPriceFcfaMonthly',
  'auditBasicPriceFcfa',
  'boostPriceFcfa',
]);

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
  private async localeOf(opts: {
    userId?: string;
    email?: string;
  }): Promise<Locale> {
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
    // Compte sans email réel (ex. inscription par téléphone seul — voir
    // user-display.util) : envoyer à cette adresse échouerait de toute façon
    // (domaine inexistant). On l'évite pour ne pas polluer les logs d'un
    // échec SMTP attendu ; l'utilisateur reste joignable via notification
    // in-app / push (voir pushInApp, déjà déclenché en parallèle pour la
    // plupart des événements).
    if (isPlaceholderEmail(to)) {
      this.logger.debug(
        `Email transactionnel ignoré (compte sans email réel) : ${to}`,
      );
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
    data: BookingNotificationData & {
      platformFee: number;
      landlordAmount: number;
    },
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref = escapeHtml(data.bookingId);

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    /* Locataire */
    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailPaymentTenantSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailPaymentTenantAmount', { total: formatNumber(tenantLoc, data.totalAmount) })}</p>` +
        `<p>${t(tenantLoc, 'mailPaymentTenantConfirmed', { listingTitle: title })}</p>` +
        `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
        this.signature(tenantLoc),
    );

    /* Bailleur */
    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailPaymentLandlordSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
        `<p>${t(landlordLoc, 'mailPaymentLandlordBody', { tenantName: tenant, listingTitle: title })}</p>` +
        `<p>${t(landlordLoc, 'mailPaymentTotalLabel', { total: formatNumber(landlordLoc, data.totalAmount) })}</p>` +
        `<p>${t(landlordLoc, 'mailPaymentFeeLabel', { fee: formatNumber(landlordLoc, data.platformFee) })}</p>` +
        `<p>${t(landlordLoc, 'mailPaymentNetLabel', { net: formatNumber(landlordLoc, data.landlordAmount) })}</p>` +
        `<p>${t(landlordLoc, 'mailPaymentEscrowNote')}</p>` +
        this.signature(landlordLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'PAYMENT_CONFIRMED',
        'pushPaymentConfirmedTitle',
        'pushPaymentConfirmedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId },
      );
    }

    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'PAYMENT_RECEIVED',
        'pushPaymentReceivedTitle',
        'pushPaymentReceivedBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
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

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingRequestTenantSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailBookingRequestTenantBody', { listingTitle: title, city })}</p>` +
        `<p>${t(tenantLoc, 'mailAmountLabel', { amount: formatNumber(tenantLoc, data.totalAmount) })}</p>` +
        `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
        this.signature(tenantLoc),
    );

    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailBookingRequestLandlordSubject', {
        listingTitle: data.listingTitle,
      }),
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
      void this.pushInApp(
        data.landlordId,
        'NEW_BOOKING',
        'pushNewBookingTitle',
        'pushNewBookingBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  async notifyBookingConfirmed(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const city = escapeHtml(data.listingCity);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingConfirmedSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'mailBookingConfirmedTitle', { firstName: tenant })}</h2>` +
        `<p>${t(tenantLoc, 'mailBookingConfirmedBody', { listingTitle: title, city })}</p>` +
        `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
        this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        t(tenantLoc, 'pushBookingConfirmedTitle'),
        t(tenantLoc, 'pushBookingConfirmedBody', {
          listingTitle: data.listingTitle,
        }),
        { bookingId: data.bookingId },
      );

      void this.pushInApp(
        data.tenantId,
        'BOOKING_CONFIRMED',
        'pushBookingConfirmedTitle',
        'pushBookingConfirmedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  async notifyBookingCancelled(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingCancelledSubject', {
        listingTitle: data.listingTitle,
      }),
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
        t(tenantLoc, 'pushBookingCancelledBody', {
          listingTitle: data.listingTitle,
        }),
        { bookingId: data.bookingId },
      );

      void this.pushInApp(
        data.tenantId,
        'BOOKING_CANCELLED',
        'pushBookingCancelledTitle',
        'pushBookingCancelledBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }

    /* Bailleur notifié si c'est le locataire qui annule */
    if (data.landlordId && data.tenantId) {
      void this.pushInApp(
        data.landlordId,
        'BOOKING_CANCELLED',
        'pushBookingCancelledByTenantTitle',
        'pushBookingCancelledByTenantBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  /**
   * Séjour nuitée passé automatiquement à COMPLETED par le cron
   * `BookingsService.autoCompleteBookings` (le bailleur n'a pas cliqué
   * "Terminer" dans les 48h suivant la fin du séjour). Prévient le locataire
   * (invitation à laisser un avis) et le bailleur (fonds libérés).
   */
  async notifyBookingAutoCompleted(
    data: BookingNotificationData,
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailBookingCompletedSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailBookingCompletedBody', { listingTitle: title })}</p>` +
        `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
        this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        t(tenantLoc, 'pushBookingCompletedTenantTitle'),
        t(tenantLoc, 'pushBookingCompletedTenantBody', {
          listingTitle: data.listingTitle,
        }),
        { bookingId: data.bookingId },
      );

      void this.pushInApp(
        data.tenantId,
        'BOOKING_COMPLETED',
        'pushBookingCompletedTenantTitle',
        'pushBookingCompletedTenantBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }

    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'BOOKING_COMPLETED',
        'pushBookingCompletedLandlordTitle',
        'pushBookingCompletedLandlordBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  /* ── Location mensuelle (système hybride) ──────────────────────────────── */

  // Bailleur/agence : nouvelle demande de location au mois
  async notifyMonthlyRequestCreated(
    data: BookingNotificationData,
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);
    const ref = escapeHtml(data.bookingId);

    const landlordLoc = await this.localeOf({
      userId: data.landlordId,
      email: data.landlordEmail,
    });

    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailMonthlyRequestSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
        `<p>${t(landlordLoc, 'mailMonthlyRequestBody', { tenantName: tenant, listingTitle: title })}</p>` +
        `<p>${t(landlordLoc, 'mailRefLabel', { ref })}</p>` +
        this.signature(landlordLoc),
    );

    if (data.landlordId) {
      void this.onesignal.sendToExternalIds(
        [data.landlordId],
        t(landlordLoc, 'pushMonthlyRequestTitle'),
        t(landlordLoc, 'pushMonthlyRequestBody', {
          tenantName: data.tenantName,
          listingTitle: data.listingTitle,
        }),
        { bookingId: data.bookingId },
      );
      void this.pushInApp(
        data.landlordId,
        'MONTHLY_REQUEST_CREATED',
        'pushMonthlyRequestTitle',
        'pushMonthlyRequestBody',
        { tenantName: data.tenantName, listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  // Locataire : le bailleur/agence a approuvé la demande — à payer
  async notifyMonthlyRequestApproved(
    data: BookingNotificationData,
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const ref = escapeHtml(data.bookingId);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailMonthlyApprovedSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailMonthlyApprovedBody', { listingTitle: title })}</p>` +
        `<p>${t(tenantLoc, 'mailAmountLabel', { amount: formatNumber(tenantLoc, data.totalAmount) })}</p>` +
        `<p>${t(tenantLoc, 'mailRefLabel', { ref })}</p>` +
        this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.onesignal.sendToExternalIds(
        [data.tenantId],
        t(tenantLoc, 'pushMonthlyApprovedTitle'),
        t(tenantLoc, 'pushMonthlyApprovedBody', {
          listingTitle: data.listingTitle,
        }),
        { bookingId: data.bookingId },
      );
      void this.pushInApp(
        data.tenantId,
        'MONTHLY_REQUEST_APPROVED',
        'pushMonthlyApprovedTitle',
        'pushMonthlyApprovedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  // Locataire : le bailleur/agence a refusé la demande
  async notifyMonthlyRequestRejected(
    data: BookingNotificationData,
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailMonthlyRejectedSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailMonthlyRejectedBody', { listingTitle: title })}</p>` +
        this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'MONTHLY_REQUEST_REJECTED',
        'pushMonthlyRejectedTitle',
        'pushMonthlyRejectedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  // Les deux parties : le bail mensuel vient d'être résilié
  async notifyLeaseTerminated(
    data: BookingNotificationData & { terminatedByTenant: boolean },
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailLeaseTerminatedSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailLeaseTerminatedBody', { listingTitle: title })}</p>` +
        this.signature(tenantLoc),
    );
    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailLeaseTerminatedSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
        `<p>${t(landlordLoc, 'mailLeaseTerminatedBody', { listingTitle: title })}</p>` +
        this.signature(landlordLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'LEASE_TERMINATED',
        'pushLeaseTerminatedTitle',
        'pushLeaseTerminatedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'LEASE_TERMINATED',
        'pushLeaseTerminatedTitle',
        'pushLeaseTerminatedBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  /**
   * Préavis de résiliation déclenché par le bailleur ou le locataire (voir
   * `BookingsService.terminateLease`) — le bail reste ACTIF jusqu'à
   * `effectiveAt`. Prévient les DEUX parties avec la date d'effet ; celle qui
   * n'est pas à l'origine de la demande est celle qui a le plus besoin d'être
   * informée, mais l'auteur reçoit aussi une confirmation.
   */
  async notifyLeaseTerminationScheduled(
    data: BookingNotificationData & {
      requestedByTenant: boolean;
      effectiveAt: Date;
    },
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    const dateStr = (loc: Locale) =>
      data.effectiveAt.toLocaleDateString(loc === 'en' ? 'en-US' : 'fr-SN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailLeaseTerminationScheduledSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailLeaseTerminationScheduledBody', { listingTitle: title, date: dateStr(tenantLoc) })}</p>` +
        this.signature(tenantLoc),
    );
    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailLeaseTerminationScheduledSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
        `<p>${t(landlordLoc, 'mailLeaseTerminationScheduledBody', { listingTitle: title, date: dateStr(landlordLoc) })}</p>` +
        this.signature(landlordLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'LEASE_TERMINATION_SCHEDULED',
        'pushLeaseTerminationScheduledTitle',
        'pushLeaseTerminationScheduledBody',
        { listingTitle: data.listingTitle, date: dateStr(tenantLoc) },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'LEASE_TERMINATION_SCHEDULED',
        'pushLeaseTerminationScheduledTitle',
        'pushLeaseTerminationScheduledBody',
        { listingTitle: data.listingTitle, date: dateStr(landlordLoc) },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  /** Annulation d'une résiliation de bail programmée — le bail se poursuit sans interruption. */
  async notifyLeaseTerminationCancelled(
    data: BookingNotificationData,
  ): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);
    const landlord = escapeHtml(data.landlordName);

    const [tenantLoc, landlordLoc] = await Promise.all([
      this.localeOf({ userId: data.tenantId, email: data.tenantEmail }),
      this.localeOf({ userId: data.landlordId, email: data.landlordEmail }),
    ]);

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailLeaseTerminationCancelledSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailLeaseTerminationCancelledBody', { listingTitle: title })}</p>` +
        this.signature(tenantLoc),
    );
    await this.send(
      data.landlordEmail,
      t(landlordLoc, 'mailLeaseTerminationCancelledSubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(landlordLoc, 'commonHello', { firstName: landlord })},</h2>` +
        `<p>${t(landlordLoc, 'mailLeaseTerminationCancelledBody', { listingTitle: title })}</p>` +
        this.signature(landlordLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'LEASE_TERMINATION_CANCELLED',
        'pushLeaseTerminationCancelledTitle',
        'pushLeaseTerminationCancelledBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
    if (data.landlordId) {
      void this.pushInApp(
        data.landlordId,
        'LEASE_TERMINATION_CANCELLED',
        'pushLeaseTerminationCancelledTitle',
        'pushLeaseTerminationCancelledBody',
        { listingTitle: data.listingTitle },
        { bookingId: data.bookingId, listingTitle: data.listingTitle },
      );
    }
  }

  // Locataire : le contrat de bail (modèle avec espaces libres) est prêt au
  // téléchargement — à compléter et signer manuscritement en personne avec
  // le bailleur/l'agence.
  async notifyContractReady(data: BookingNotificationData): Promise<void> {
    const title = escapeHtml(data.listingTitle);
    const tenant = escapeHtml(data.tenantName);

    const tenantLoc = await this.localeOf({
      userId: data.tenantId,
      email: data.tenantEmail,
    });

    await this.send(
      data.tenantEmail,
      t(tenantLoc, 'mailContractReadySubject', {
        listingTitle: data.listingTitle,
      }),
      `<h2>${t(tenantLoc, 'commonHello', { firstName: tenant })},</h2>` +
        `<p>${t(tenantLoc, 'mailContractReadyBody', { listingTitle: title })}</p>` +
        this.signature(tenantLoc),
    );

    if (data.tenantId) {
      void this.pushInApp(
        data.tenantId,
        'CONTRACT_READY',
        'pushContractReadyTitle',
        'pushContractReadyBody',
        { listingTitle: data.listingTitle },
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
      'pushReviewReceivedTitle',
      'pushReviewReceivedBody',
      { tenantName, stars, listingTitle },
      { listingId, listingTitle, rating },
    );
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
    /* Signal léger pour le badge Messages de la sidebar (DashboardShell) —
     * pas d'écriture en base ni d'entrée dans la cloche (déjà couvert par le
     * push OneSignal + la messagerie elle-même) : juste de quoi déclencher un
     * refetch du compteur non-lus, même si /messages n'est pas ouvert. */
    void this.pusher.trigger(`user-${recipientId}`, 'unread-badge', {});
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
    await this.pushInApp(
      agentId,
      'VERIF_ASSIGNED',
      'pushVerifAssignedTitle',
      'pushVerifAssignedBody',
      { listingTitle },
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
      'pushVerifScheduledTitle',
      'pushVerifScheduledBody',
      { agentName, listingTitle },
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
      'pushVerifInProgressTitle',
      'pushVerifInProgressBody',
      { listingTitle },
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
      'pushVerifDoneTitle',
      'pushVerifDoneBody',
      { listingTitle },
      { verificationId, listingTitle, listingId },
    );
  }

  // Bailleur : mission rejetée par l'agent (bien non conforme) — émet un
  // crédit de re-soumission gratuit si le bailleur avait payé (creditIssued).
  async notifyVerifRejectedWithCredit(
    bailleurId: string,
    listingTitle: string,
    listingId: string,
    reason: string,
    creditIssued: boolean,
  ) {
    await this.pushInApp(
      bailleurId,
      'VERIF_REJECTED',
      'pushVerifRejectedTitle',
      creditIssued ? 'pushVerifRejectedCreditBody' : 'pushVerifRejectedBody',
      { listingTitle, reason },
      { listingTitle, listingId, reason },
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
      'pushVerifDeclinedTitle',
      'pushVerifDeclinedBody',
      { listingTitle },
      { verificationId, listingTitle, listingId },
    );
  }

  // Admin : nouveau signalement d'annonce
  // Admin : un même expéditeur dépasse le seuil de tentatives de
  // contournement filtrées (numéro/email/app externe) sur 24h glissantes —
  // voir MessagesService.logAndMaybeAlertCircumvention (Task #121).
  async notifyContactFilterAlert(
    senderId: string,
    senderName: string,
    roomId: string,
    count: number,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.pushInApp(
          admin.id,
          'CONTACT_FILTER_ALERT',
          'pushContactFilterAlertTitle',
          'pushContactFilterAlertBody',
          { senderName, count, roomId },
          { senderId, roomId, count },
        ),
      ),
    );
  }

  // Bailleur/agence : annonce suspendue par un admin (suite à un
  // signalement ou non) — on notifie uniquement l'issue, jamais le
  // signalement brut ni l'identité de l'éventuel auteur du signalement.
  async notifyListingSuspended(ownerId: string, listingTitle: string) {
    await this.pushInApp(
      ownerId,
      'LISTING_SUSPENDED',
      'pushListingSuspendedTitle',
      'pushListingSuspendedBody',
      { listingTitle },
      { listingTitle },
    );
  }

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

    await Promise.all(
      admins.map((admin) => {
        const loc = toLocale(admin.locale);
        return this.prisma.notification
          .create({
            data: {
              userId: admin.id,
              type: 'LISTING_REPORTED',
              title: t(
                loc,
                urgent
                  ? 'pushListingReportedUrgentTitle'
                  : 'pushListingReportedTitle',
              ),
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
      }),
    );
  }

  // Admin : nouvelle demande AlloVérifié (statut REQUESTED) — aucun agent
  // n'est encore assigné, une action admin (assignAgent) est requise. Appelée
  // depuis VerificationsService.create() (chemin gratuit admin/PRO) et
  // createVerificationFromPayment() (chemin payant, une fois le paiement
  // confirmé).
  async notifyAdminNewVerificationRequest(
    listingTitle: string,
    verificationId: string,
    listingId: string,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.pushInApp(
          admin.id,
          'VERIF_REQUESTED',
          'pushVerifRequestedTitle',
          'pushVerifRequestedBody',
          { listingTitle },
          { verificationId, listingTitle, listingId },
        ),
      ),
    );
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
    await Promise.all(
      admins.map((admin) =>
        this.pushInApp(
          admin.id,
          'VERIF_DECLINE_REQUEST',
          'pushDeclineRequestTitle',
          'pushDeclineRequestBody',
          { listingTitle },
          { verificationId, listingTitle, listingId },
        ),
      ),
    );
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
      this.pushInApp(
        landlordId,
        'BOOKING_DISPUTED',
        'pushDisputeReportedLandlordTitle',
        'pushDisputeReportedLandlordBody',
        { listingTitle },
        { bookingId, listingTitle, listingId },
      ),
      ...admins.map((admin) =>
        this.pushInApp(
          admin.id,
          'BOOKING_DISPUTED',
          'pushDisputeReportedAdminTitle',
          'pushDisputeReportedAdminBody',
          { listingTitle },
          { bookingId, listingTitle, listingId },
        ),
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
      this.pushInApp(
        tenantId,
        'DISPUTE_RESOLVED',
        released
          ? 'pushDisputeResolvedReleaseTenantTitle'
          : 'pushDisputeResolvedRefundTenantTitle',
        released
          ? 'pushDisputeResolvedReleaseTenantBody'
          : 'pushDisputeResolvedRefundTenantBody',
        { listingTitle },
        { bookingId, listingTitle, listingId },
      ),
      this.pushInApp(
        landlordId,
        'DISPUTE_RESOLVED',
        released
          ? 'pushDisputeResolvedReleaseLandlordTitle'
          : 'pushDisputeResolvedRefundLandlordTitle',
        released
          ? 'pushDisputeResolvedReleaseLandlordBody'
          : 'pushDisputeResolvedRefundLandlordBody',
        { listingTitle },
        { bookingId, listingTitle, listingId },
      ),
    ]);
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
      'pushVerifValidatedTitle',
      'pushVerifValidatedBody',
      { listingTitle },
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

  /* Broadcast admin : le titre et le message sont saisis à la main par
   * l'administrateur, donc envoyés tels quels sans traduction.
   *
   * Contrairement aux autres notifications (transactionnelles, déclenchées
   * par un événement), un broadcast doit être immédiatement identifiable
   * comme venant de la Direction et non de la plateforme elle-même — d'où le
   * préfixe "De la part d'AlloAppart" sur le push OneSignal, et le type
   * dédié ADMIN_BROADCAST côté cloche in-app (NotificationBell lui applique
   * un style doré + icône couronne distinct des notifications automatiques).
   *
   * Jusqu'ici seul le push OneSignal était envoyé (rien dans la cloche) : on
   * a donc désormais besoin des ids de chaque destinataire — y compris pour
   * le segment ALL, qui se contentait auparavant d'un count() — pour créer
   * la ligne Notification correspondante. `createMany` + ids générés côté
   * code (plutôt que laissés au défaut Prisma) permet un insert en lot tout
   * en gardant un id stable à transmettre immédiatement via Pusher. */
  async broadcastPush(
    title: string,
    message: string,
    segment: BroadcastSegment,
  ): Promise<{ sent: boolean; recipients: number }> {
    const roleMap: Record<string, Role> = {
      BAILLEURS: Role.BAILLEUR,
      LOCATAIRES: Role.LOCATAIRE,
      PRO_AGENCES: Role.PRO_AGENCE,
      AGENTS_TERRAIN: Role.AGENT_TERRAIN,
    };

    const users =
      segment === 'ALL'
        ? await this.prisma.user.findMany({
            select: { id: true, clerkId: true },
          })
        : await this.prisma.user.findMany({
            where: { roles: { has: roleMap[segment] } },
            select: { id: true, clerkId: true },
          });

    const externalIds = users.map((u) => u.clerkId);
    const recipients = users.length;

    const brandedTitle = `De la part d'AlloAppart — ${title}`;
    await this.onesignal.sendBroadcast(
      brandedTitle,
      message,
      segment === 'ALL' ? undefined : externalIds,
    );

    if (recipients > 0) {
      const rows = users.map((u) => ({
        id: randomUUID(),
        userId: u.id,
        type: 'ADMIN_BROADCAST',
        title,
        body: message,
      }));
      await this.prisma.notification.createMany({ data: rows });
      const createdAt = new Date().toISOString();
      for (const row of rows) {
        void this.pusher.trigger(`user-${row.userId}`, 'notification', {
          ...row,
          isRead: false,
          createdAt,
        });
      }
    }

    this.logger.log(
      `broadcastPush segment=${segment} recipients=${recipients}`,
    );
    return { sent: true, recipients };
  }

  /** Formate une valeur de champ tarifaire pour affichage dans une langue donnée. */
  private formatConfigFieldValue(
    field: ConfigFieldKey,
    value: number,
    loc: Locale,
  ): string {
    if (field === 'nightlyCommissionRate') {
      return `${Math.round(value * 1000) / 10}%`;
    }
    if (field === 'monthlyCommissionMonths') {
      return t(loc, 'configMonthsUnitCount', { count: value });
    }
    return FCFA_FIELDS.has(field)
      ? `${formatNumber(loc, value)} FCFA`
      : String(value);
  }

  /* Bailleurs/agences PRO : notifiés (in-app + push + email) quand l'admin
   * modifie la tarification de la plateforme (plans, commission, AlloVérifié,
   * boost) depuis espace/config — ce sont les seuls rôles concernés par ces
   * tarifs (les locataires ne voient ni commission ni prix d'abonnement).
   * L'email est requis par les CGU (Article 7 : préavis de 30 jours
   * "communiqué par e-mail aux utilisateurs enregistrés"). `effectiveAt` est
   * la date de prise d'effet programmée, ou null si le changement s'applique
   * immédiatement (correctif urgent, effectiveInDays = 0). */
  async notifyPlatformConfigChanged(
    changes: ConfigFieldChange[],
    effectiveAt: Date | null,
  ): Promise<void> {
    if (changes.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { roles: { hasSome: [Role.BAILLEUR, Role.PRO_AGENCE] } },
      select: { id: true, clerkId: true, email: true, locale: true },
    });
    if (users.length === 0) return;

    const byLocale = new Map<
      Locale,
      { userId: string; clerkId: string; email: string }[]
    >();
    for (const u of users) {
      const loc = toLocale(u.locale);
      const group = byLocale.get(loc) ?? [];
      group.push({ userId: u.id, clerkId: u.clerkId, email: u.email });
      byLocale.set(loc, group);
    }

    await Promise.all(
      Array.from(byLocale.entries()).map(async ([loc, group]) => {
        const summary = changes
          .map((c) => {
            const label = t(loc, CONFIG_FIELD_LABELS[c.field]);
            const from = this.formatConfigFieldValue(c.field, c.oldValue, loc);
            const to = this.formatConfigFieldValue(c.field, c.newValue, loc);
            return `${label} : ${from} → ${to}`;
          })
          .join(' · ');
        const dateStr = effectiveAt
          ? effectiveAt.toLocaleDateString(loc === 'en' ? 'en-US' : 'fr-SN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : null;

        const title = t(loc, 'pushConfigChangedTitle');
        const when = effectiveAt
          ? t(loc, 'pushConfigChangedEffectiveAt', { date: dateStr! })
          : t(loc, 'pushConfigChangedEffectiveNow');
        const body = t(loc, 'pushConfigChangedBody', {
          changes: summary,
          when,
        });

        await Promise.all(
          group.map((u) =>
            this.prisma.notification
              .create({
                data: {
                  userId: u.userId,
                  type: 'PLATFORM_CONFIG_CHANGED',
                  title,
                  body,
                  metadata: {
                    changes,
                    effectiveAt: effectiveAt?.toISOString() ?? null,
                  } as unknown as Prisma.InputJsonValue,
                },
              })
              .then((notif) => {
                void this.pusher.trigger(
                  `user-${u.userId}`,
                  'notification',
                  notif,
                );
              }),
          ),
        );

        const externalIds = group.map((u) => u.clerkId).filter(Boolean);
        if (externalIds.length) {
          void this.onesignal.sendToExternalIds(externalIds, title, body, {
            type: 'PLATFORM_CONFIG_CHANGED',
          });
        }

        // Email — requis par les CGU (Article 7 : préavis communiqué par
        // e-mail). Un email par destinataire réel (send() ignore déjà les
        // comptes sans adresse réelle, ex. inscription par téléphone seul).
        const emailSubject = t(loc, 'mailConfigChangedSubject');
        const emailBody =
          `<p>${t(loc, 'mailConfigChangedIntro')}</p>` +
          `<ul>${changes
            .map((c) => {
              const label = t(loc, CONFIG_FIELD_LABELS[c.field]);
              const from = this.formatConfigFieldValue(
                c.field,
                c.oldValue,
                loc,
              );
              const to = this.formatConfigFieldValue(c.field, c.newValue, loc);
              return `<li>${label} : ${from} → ${to}</li>`;
            })
            .join('')}</ul>` +
          `<p>${
            effectiveAt
              ? t(loc, 'mailConfigChangedEffectiveAt', { date: dateStr! })
              : t(loc, 'mailConfigChangedEffectiveNow')
          }</p>` +
          this.signature(loc);

        await Promise.all(
          group.map((u) => this.send(u.email, emailSubject, emailBody)),
        );
      }),
    );

    this.logger.log(
      `notifyPlatformConfigChanged: ${users.length} destinataire(s) (BAILLEUR/PRO_AGENCE), ${changes.length} champ(s) modifié(s), effectiveAt=${effectiveAt?.toISOString() ?? 'immédiat'}`,
    );
  }

  /* Annulation d'un changement tarifaire programmé, avant son échéance —
   * mêmes destinataires que notifyPlatformConfigChanged. */
  async notifyPlatformConfigChangeCancelled(
    cancelledEffectiveAt: Date,
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { roles: { hasSome: [Role.BAILLEUR, Role.PRO_AGENCE] } },
      select: { id: true, clerkId: true, email: true, locale: true },
    });
    if (users.length === 0) return;

    const byLocale = new Map<
      Locale,
      { userId: string; clerkId: string; email: string }[]
    >();
    for (const u of users) {
      const loc = toLocale(u.locale);
      const group = byLocale.get(loc) ?? [];
      group.push({ userId: u.id, clerkId: u.clerkId, email: u.email });
      byLocale.set(loc, group);
    }

    await Promise.all(
      Array.from(byLocale.entries()).map(async ([loc, group]) => {
        const dateStr = cancelledEffectiveAt.toLocaleDateString(
          loc === 'en' ? 'en-US' : 'fr-SN',
          { year: 'numeric', month: 'long', day: 'numeric' },
        );
        const title = t(loc, 'pushConfigChangeCancelledTitle');
        const body = t(loc, 'pushConfigChangeCancelledBody', {
          date: dateStr,
        });

        await Promise.all(
          group.map((u) =>
            this.prisma.notification
              .create({
                data: {
                  userId: u.userId,
                  type: 'PLATFORM_CONFIG_CHANGE_CANCELLED',
                  title,
                  body,
                },
              })
              .then((notif) => {
                void this.pusher.trigger(
                  `user-${u.userId}`,
                  'notification',
                  notif,
                );
              }),
          ),
        );

        const externalIds = group.map((u) => u.clerkId).filter(Boolean);
        if (externalIds.length) {
          void this.onesignal.sendToExternalIds(externalIds, title, body, {
            type: 'PLATFORM_CONFIG_CHANGE_CANCELLED',
          });
        }

        const emailSubject = t(loc, 'mailConfigCancelledSubject');
        const emailBody =
          `<p>${t(loc, 'mailConfigCancelledBody', { date: dateStr })}</p>` +
          this.signature(loc);
        await Promise.all(
          group.map((u) => this.send(u.email, emailSubject, emailBody)),
        );
      }),
    );

    this.logger.log(
      `notifyPlatformConfigChangeCancelled: ${users.length} destinataire(s)`,
    );
  }
}
