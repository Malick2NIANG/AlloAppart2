import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';
import type { PlatformConfig, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  NotificationsService,
  type ConfigFieldChange,
  type ConfigFieldKey,
} from '../notifications/notifications.service';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { ConfirmActionDto } from './dto/confirm-action.dto';

const DEFAULT_PIN = '2002';
const OTP_TTL_MS = 10 * 60 * 1000;
const SINGLETON_ID = 'singleton';

/** Préavis par défaut avant l'entrée en vigueur d'un changement tarifaire —
 * CGU Article 7 : "Les tarifs peuvent être modifiés avec un préavis de 30
 * jours communiqué par e-mail aux utilisateurs enregistrés." */
const DEFAULT_NOTICE_DAYS = 30;

const PRICING_FIELDS = [
  'starterPriceFcfa',
  'proPriceFcfaMonthly',
  'nightlyCommissionRate',
  'monthlyCommissionMonths',
  'auditBasicPriceFcfa',
  'boostPriceFcfa',
] as const satisfies readonly ConfigFieldKey[];

/** data Prisma qui efface tout changement tarifaire programmé. */
const CLEAR_PENDING = {
  pendingStarterPriceFcfa: null,
  pendingProPriceFcfaMonthly: null,
  pendingNightlyCommissionRate: null,
  pendingMonthlyCommissionMonths: null,
  pendingAuditBasicPriceFcfa: null,
  pendingBoostPriceFcfa: null,
  pendingEffectiveAt: null,
  pendingSetByEmail: null,
  pendingSetAt: null,
};

function makeSalt(): string {
  return randomBytes(16).toString('hex');
}

function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 64).toString('hex');
}

function safeEqual(candidateHex: string, expectedHex: string): boolean {
  const a = Buffer.from(candidateHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface PendingPlatformConfig {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
  effectiveAt: Date;
  setByEmail: string | null;
}

export interface PublicPlatformConfig {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
  updatedAt: Date;
  updatedByEmail: string | null;
  /** Changement tarifaire programmé (préavis en cours), ou null si aucun. */
  pending: PendingPlatformConfig | null;
}

export interface PlatformPricing {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
}

/**
 * Configuration tarifaire de la plateforme (plans, commission, AlloVérifié,
 * boost) — éditable depuis espace/config, protégée par un code PIN (par
 * défaut 2002, modifiable) ou par un code de confirmation envoyé par email
 * (OTP, valable 10 minutes). Ligne unique en base ("singleton"), créée à la
 * volée avec les valeurs par défaut au premier accès.
 *
 * Préavis (CGU Article 7) : une modification tarifaire n'est pas appliquée
 * immédiatement mais programmée (30 jours par défaut, ajustable par l'admin,
 * 0 = immédiat pour un correctif urgent). Tant que l'échéance n'est pas
 * atteinte, les valeurs courantes restent en vigueur ; à l'échéance, la
 * prochaine lecture promeut automatiquement le changement (pas de tâche
 * planifiée nécessaire — voir promoteIfDue).
 */
@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getOrCreateRow(): Promise<PlatformConfig> {
    const existing = await this.prisma.platformConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!existing) {
      const salt = makeSalt();
      return this.prisma.platformConfig.create({
        data: {
          id: SINGLETON_ID,
          pinHash: hashCode(DEFAULT_PIN, salt),
          pinSalt: salt,
        },
      });
    }
    return this.promoteIfDue(existing);
  }

  /** Promeut pending* → valeurs live si l'échéance du préavis est atteinte. */
  private async promoteIfDue(row: PlatformConfig): Promise<PlatformConfig> {
    if (!row.pendingEffectiveAt || row.pendingEffectiveAt > new Date()) {
      return row;
    }
    const promoted = await this.prisma.platformConfig.update({
      where: { id: SINGLETON_ID },
      data: {
        starterPriceFcfa: row.pendingStarterPriceFcfa ?? row.starterPriceFcfa,
        proPriceFcfaMonthly:
          row.pendingProPriceFcfaMonthly ?? row.proPriceFcfaMonthly,
        nightlyCommissionRate:
          row.pendingNightlyCommissionRate ?? row.nightlyCommissionRate,
        monthlyCommissionMonths:
          row.pendingMonthlyCommissionMonths ?? row.monthlyCommissionMonths,
        auditBasicPriceFcfa:
          row.pendingAuditBasicPriceFcfa ?? row.auditBasicPriceFcfa,
        boostPriceFcfa: row.pendingBoostPriceFcfa ?? row.boostPriceFcfa,
        ...CLEAR_PENDING,
      },
    });
    this.logger.log(
      `Changement de tarification programmé par ${row.pendingSetByEmail ?? '?'} appliqué (échéance atteinte)`,
    );
    return promoted;
  }

  private toPublic(row: PlatformConfig): PublicPlatformConfig {
    return {
      starterPriceFcfa: row.starterPriceFcfa,
      proPriceFcfaMonthly: row.proPriceFcfaMonthly,
      nightlyCommissionRate: row.nightlyCommissionRate,
      monthlyCommissionMonths: row.monthlyCommissionMonths,
      auditBasicPriceFcfa: row.auditBasicPriceFcfa,
      boostPriceFcfa: row.boostPriceFcfa,
      updatedAt: row.updatedAt,
      updatedByEmail: row.updatedByEmail,
      pending: row.pendingEffectiveAt
        ? {
            starterPriceFcfa:
              row.pendingStarterPriceFcfa ?? row.starterPriceFcfa,
            proPriceFcfaMonthly:
              row.pendingProPriceFcfaMonthly ?? row.proPriceFcfaMonthly,
            nightlyCommissionRate:
              row.pendingNightlyCommissionRate ?? row.nightlyCommissionRate,
            monthlyCommissionMonths:
              row.pendingMonthlyCommissionMonths ?? row.monthlyCommissionMonths,
            auditBasicPriceFcfa:
              row.pendingAuditBasicPriceFcfa ?? row.auditBasicPriceFcfa,
            boostPriceFcfa: row.pendingBoostPriceFcfa ?? row.boostPriceFcfa,
            effectiveAt: row.pendingEffectiveAt,
            setByEmail: row.pendingSetByEmail,
          }
        : null,
    };
  }

  async getConfig(): Promise<PublicPlatformConfig> {
    return this.toPublic(await this.getOrCreateRow());
  }

  /** Valeurs tarifaires courantes — consommé par subscriptions/verifications/listings/bookings. */
  async getPricing(): Promise<PlatformPricing> {
    const row = await this.getOrCreateRow();
    return {
      starterPriceFcfa: row.starterPriceFcfa,
      proPriceFcfaMonthly: row.proPriceFcfaMonthly,
      nightlyCommissionRate: row.nightlyCommissionRate,
      monthlyCommissionMonths: row.monthlyCommissionMonths,
      auditBasicPriceFcfa: row.auditBasicPriceFcfa,
      boostPriceFcfa: row.boostPriceFcfa,
    };
  }

  async requestOtp(
    admin: Pick<User, 'id' | 'email' | 'locale'>,
  ): Promise<{ sent: boolean; expiresInSeconds: number }> {
    const code = String(randomInt(100_000, 1_000_000));
    const salt = makeSalt();
    await this.prisma.adminConfigOtp.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        codeHash: hashCode(code, salt),
        codeSalt: salt,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.mail.sendConfigOtp({
      to: admin.email,
      code,
      locale: admin.locale,
    });
    this.logger.log(`Code OTP config envoyé à ${admin.email}`);
    return { sent: true, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  private async verifyConfirmation(
    admin: Pick<User, 'id'>,
    method: 'PIN' | 'OTP',
    code: string,
  ): Promise<void> {
    if (method === 'PIN') {
      const row = await this.getOrCreateRow();
      if (!safeEqual(hashCode(code, row.pinSalt), row.pinHash)) {
        throw new BadRequestException('Code PIN invalide.');
      }
      return;
    }

    const otp = await this.prisma.adminConfigOtp.findFirst({
      where: {
        adminId: admin.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || !safeEqual(hashCode(code, otp.codeSalt), otp.codeHash)) {
      throw new BadRequestException('Code de confirmation invalide ou expiré.');
    }
    await this.prisma.adminConfigOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  async updateConfig(
    admin: User,
    dto: UpdatePlatformConfigDto,
  ): Promise<PublicPlatformConfig> {
    await this.verifyConfirmation(admin, dto.confirmMethod, dto.confirmCode);
    const before = await this.getOrCreateRow();

    const changedFields = PRICING_FIELDS.filter(
      (field) => dto[field] !== undefined && dto[field] !== before[field],
    );

    if (changedFields.length === 0) {
      return this.toPublic(before);
    }

    const effectiveInDays = dto.effectiveInDays ?? DEFAULT_NOTICE_DAYS;
    const immediate = effectiveInDays <= 0;
    const effectiveAt = immediate
      ? null
      : new Date(Date.now() + effectiveInDays * 24 * 60 * 60 * 1000);

    const row = immediate
      ? await this.prisma.platformConfig.update({
          where: { id: SINGLETON_ID },
          data: {
            starterPriceFcfa: dto.starterPriceFcfa,
            proPriceFcfaMonthly: dto.proPriceFcfaMonthly,
            nightlyCommissionRate: dto.nightlyCommissionRate,
            monthlyCommissionMonths: dto.monthlyCommissionMonths,
            auditBasicPriceFcfa: dto.auditBasicPriceFcfa,
            boostPriceFcfa: dto.boostPriceFcfa,
            updatedByEmail: admin.email,
            // Un changement immédiat écrase toute modification déjà programmée.
            ...CLEAR_PENDING,
          },
        })
      : await this.prisma.platformConfig.update({
          where: { id: SINGLETON_ID },
          data: {
            pendingStarterPriceFcfa:
              dto.starterPriceFcfa ?? before.starterPriceFcfa,
            pendingProPriceFcfaMonthly:
              dto.proPriceFcfaMonthly ?? before.proPriceFcfaMonthly,
            pendingNightlyCommissionRate:
              dto.nightlyCommissionRate ?? before.nightlyCommissionRate,
            pendingMonthlyCommissionMonths:
              dto.monthlyCommissionMonths ?? before.monthlyCommissionMonths,
            pendingAuditBasicPriceFcfa:
              dto.auditBasicPriceFcfa ?? before.auditBasicPriceFcfa,
            pendingBoostPriceFcfa: dto.boostPriceFcfa ?? before.boostPriceFcfa,
            pendingEffectiveAt: effectiveAt,
            pendingSetByEmail: admin.email,
            pendingSetAt: new Date(),
          },
        });

    this.logger.log(
      immediate
        ? `Configuration tarifaire appliquée immédiatement par ${admin.email}`
        : `Changement de tarification programmé par ${admin.email} pour le ${effectiveAt!.toISOString()}`,
    );

    // Notifie les bailleurs/agences PRO (in-app + push + email — CGU Article
    // 7) des champs réellement modifiés — fire-and-forget pour ne pas
    // ralentir la réponse admin, qui peut concerner de nombreux destinataires.
    const changes: ConfigFieldChange[] = changedFields.map((field) => ({
      field,
      oldValue: before[field],
      newValue: dto[field] as number,
    }));
    void this.notifications
      .notifyPlatformConfigChanged(changes, effectiveAt)
      .catch((err: unknown) =>
        this.logger.error(
          'Erreur notification changement de tarification : ' +
            (err instanceof Error ? err.message : String(err)),
        ),
      );

    return this.toPublic(row);
  }

  /** Annule un changement tarifaire programmé (avant son échéance). No-op si aucun. */
  async cancelPendingChange(
    admin: User,
    dto: ConfirmActionDto,
  ): Promise<PublicPlatformConfig> {
    await this.verifyConfirmation(admin, dto.confirmMethod, dto.confirmCode);
    const before = await this.getOrCreateRow();

    if (!before.pendingEffectiveAt) {
      return this.toPublic(before);
    }

    const cancelledEffectiveAt = before.pendingEffectiveAt;
    const row = await this.prisma.platformConfig.update({
      where: { id: SINGLETON_ID },
      data: CLEAR_PENDING,
    });
    this.logger.log(
      `Changement de tarification programmé annulé par ${admin.email}`,
    );

    void this.notifications
      .notifyPlatformConfigChangeCancelled(cancelledEffectiveAt)
      .catch((err: unknown) =>
        this.logger.error(
          'Erreur notification annulation changement de tarification : ' +
            (err instanceof Error ? err.message : String(err)),
        ),
      );

    return this.toPublic(row);
  }

  async changePin(admin: User, dto: ChangePinDto): Promise<{ success: true }> {
    await this.verifyConfirmation(admin, dto.confirmMethod, dto.confirmCode);
    await this.getOrCreateRow();

    const salt = makeSalt();
    await this.prisma.platformConfig.update({
      where: { id: SINGLETON_ID },
      data: {
        pinHash: hashCode(dto.newPin, salt),
        pinSalt: salt,
        updatedByEmail: admin.email,
      },
    });
    this.logger.log(`Code PIN de configuration changé par ${admin.email}`);
    return { success: true };
  }
}
