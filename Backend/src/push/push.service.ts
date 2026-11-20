import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type * as WebPushModule from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscribeDto } from './dto/subscribe.dto';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto';

export type PushCategory = 'messages' | 'bookings' | 'payments' | 'listings';

/**
 * Lot « notifications push » — une seule table de correspondance type de
 * notification interne → catégorie de préférence. Tout type absent d'ici
 * n'est jamais poussé (ex. ADMIN_BROADCAST, LISTING_REPORTED,
 * PLATFORM_CONFIG_CHANGED, VERIF_ASSIGNED côté agent, REVIEW_RECEIVED) — hors
 * de la liste d'événements décidée par Malick, volontairement non couverts.
 */
const CATEGORY_BY_TYPE: Readonly<Record<string, PushCategory>> = {
  NEW_BOOKING: 'bookings',
  MONTHLY_REQUEST_CREATED: 'bookings',
  BOOKING_CONFIRMED: 'bookings',
  MONTHLY_REQUEST_APPROVED: 'bookings',
  MONTHLY_REQUEST_REJECTED: 'bookings',
  BOOKING_CANCELLED: 'bookings',
  BOOKING_COMPLETED: 'bookings',
  LEASE_TERMINATED: 'bookings',
  LEASE_TERMINATION_SCHEDULED: 'bookings',
  LEASE_TERMINATION_CANCELLED: 'bookings',
  PAYMENT_CONFIRMED: 'payments',
  PAYMENT_RECEIVED: 'payments',
  VERIF_SCHEDULED: 'listings',
  VERIF_IN_PROGRESS: 'listings',
  VERIF_DONE: 'listings',
  VERIF_REJECTED: 'listings',
  VERIF_DECLINED: 'listings',
  LISTING_SUSPENDED: 'listings',
};

export interface PushPayload {
  /** Titre + texte court, déjà neutres (mêmes clés i18n que la notification
   * interne/la cloche — jamais le texte d'un message, jamais un montant). */
  title: string;
  body: string;
  /** Chemin interne UNIQUEMENT (jamais une URL absolue/externe). */
  url: string;
  /** Regroupement (ex. une conversation) — évite d'empiler N notifications. */
  tag: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Point d'entrée UNIQUE d'envoi Web Push — branché depuis
 * NotificationsService.pushInApp (tous les événements qui créent déjà une
 * notification interne) et depuis notifyNewMessage (seul événement de la
 * liste de Malick sans notification interne, décision du 20/11/2026 : push
 * direct, sans écriture en base). Désactivé proprement si les clés VAPID
 * manquent — l'app fonctionne alors exactement comme avant, aucune erreur.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;
  private vapidPublicKey = '';
  // `web-push` est un paquet ESM pur (`"type": "module"`, aucune build CJS) —
  // un `import` statique casse Jest (CommonJS) dans TOUT fichier de test qui
  // charge ce service en chaîne, même sans le mocker explicitement. Import
  // dynamique, chargé une seule fois ici, jamais au niveau module.
  private webpush: typeof WebPushModule | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT absentes : notifications push désactivées (reste de l'application inchangé). Générer avec `npx web-push generate-vapid-keys`.",
      );
      return;
    }

    this.webpush = await import('web-push');
    this.webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidPublicKey = publicKey;
    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPublicKey(): string | null {
    return this.enabled ? this.vapidPublicKey : null;
  }

  categoryForType(type: string): PushCategory | null {
    return CATEGORY_BY_TYPE[type] ?? null;
  }

  /* ── Abonnements ─────────────────────────────────────────────────────── */

  /** `endpoint` UNIQUE : un même appareil ne peut appartenir qu'à un seul
   * compte. S'il appartient déjà à CET utilisateur, simple mise à jour
   * (clés/langue/horodatage) ; s'il appartient à un autre, refus explicite —
   * jamais d'écrasement silencieux (le Frontend doit désabonner l'appareil
   * à la déconnexion avant qu'un autre compte puisse s'y abonner). */
  async subscribe(userId: string, dto: SubscribeDto) {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        'Cet appareil est déjà abonné avec un autre compte.',
      );
    }

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
        locale: dto.locale,
      },
      update: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
        locale: dto.locale,
        lastUsedAt: new Date(),
      },
      select: { id: true },
    });
  }

  /** Désabonnement de CET appareil uniquement (jamais tous les appareils de
   * l'utilisateur) — même action utilisée à la déconnexion (téléphone
   * partagé) qu'au clic manuel « Couper sur cet appareil ». Silencieux si
   * l'appareil n'appartient pas (ou plus) à l'utilisateur — jamais d'erreur
   * pour un état déjà désabonné. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription
      .deleteMany({ where: { userId, endpoint } })
      .catch(() => {});
  }

  /* ── Préférences ─────────────────────────────────────────────────────── */

  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    // Pas encore de ligne = toutes les catégories activées par défaut —
    // renvoyé sans écrire en base (écrit seulement au premier PATCH réel).
    return {
      id: null,
      userId,
      messages: true,
      bookings: true,
      payments: true,
      listings: true,
      updatedAt: null,
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        messages: dto.messages ?? true,
        bookings: dto.bookings ?? true,
        payments: dto.payments ?? true,
        listings: dto.listings ?? true,
      },
      update: { ...dto },
    });
  }

  /**
   * Envoi asynchrone (fire-and-forget côté appelant, jamais `await`é dans un
   * chemin critique) : catégorie coupée ou aucun abonnement = silencieux,
   * aucune erreur ne doit jamais remonter à l'appelant (réservation, message,
   * paiement) — tout est intercepté ici.
   */
  async sendToUser(
    userId: string,
    category: PushCategory,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const pref = await this.prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (pref && pref[category] === false) return;

      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      if (!subscriptions.length) return;

      await Promise.all(subscriptions.map((sub) => this.sendOne(sub, payload)));
    } catch {
      // Jamais de contenu/endpoint dans les journaux — juste le signal
      // qu'un envoi a échoué, sans détail exploitable.
      this.logger.warn(
        'Échec de résolution des abonnements push pour un envoi.',
      );
    }
  }

  private async sendOne(
    sub: SubscriptionRow,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.webpush) return;
    try {
      await this.webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      await this.prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    } catch (err) {
      const statusCode = (err as { statusCode?: number } | undefined)
        ?.statusCode;
      // Jamais le message d'erreur brut : web-push y inclut parfois l'endpoint.
      this.logger.warn(`Envoi push échoué (code ${statusCode ?? 'inconnu'}).`);
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => {});
      }
      // Pas de réessai : un échec ponctuel (timeout, 5xx) est abandonné pour cet envoi.
    }
  }
}
