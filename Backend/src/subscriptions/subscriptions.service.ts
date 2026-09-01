import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, SubscriptionPlan, SubscriptionStatus, User } from '@prisma/client';
import axios from 'axios';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  STARTER: 75_000,
  PRO: 150_000,
};

type UserStub = Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone'>;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly softpay: PaydunyaSoftpayService,
  ) {}

  async initiate(userId: string, plan: SubscriptionPlan) {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing?.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Abonnement deja actif');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const amount = PLAN_PRICES[plan];

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: SubscriptionStatus.SUSPENDED,
        monthlyFee: amount,
      },
      update: {
        plan,
        status: SubscriptionStatus.SUSPENDED,
        monthlyFee: amount,
      },
    });

    return this.initiateWithPayDunya(subscription.id, user, amount, plan);
  }

  private async initiateWithPayDunya(
    subscriptionId: string,
    _user: UserStub,
    amount: number,
    plan: SubscriptionPlan,
  ) {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    // ── Mode bypass dev : simule le paiement sans appeler PayDunya ───────────
    if (isDev && this.config.get<string>('PAYDUNYA_DEV_BYPASS') === 'true') {
      this.logger.warn(`[DEV BYPASS] Activation directe de l'abonnement ${subscriptionId} (${plan} — ${amount} FCFA)`);
      const now     = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data:  { status: SubscriptionStatus.ACTIVE, startDate: now, endDate, paymentRef: `DEV-${Date.now()}` },
      });
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      return {
        payment_url: `${frontendUrl}/bailleur/abonnement?status=success`,
        transId:     `DEV-${Date.now()}`,
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    const masterKey = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token = this.config.get<string>('PAYDUNYA_TOKEN');

    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException('Payment service unavailable');
    }

    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const response = await axios
      .post<{ response_code: string; token: string; response_text: string }>(
        `${baseUrl}/checkout-invoice/create`,
        {
          invoice: {
            total_amount: amount,
            description: `Abonnement ${plan} -- AlloAppart`,
            return_url: `${this.config.get<string>('FRONTEND_URL')}/bailleur/abonnement?status=success`,
            cancel_url: `${this.config.get<string>('FRONTEND_URL')}/bailleur/abonnement?status=cancel`,
            callback_url: `${this.config.get<string>('BACKEND_URL')}/api/v1/subscriptions/webhook/paydunya`,
          },
          store: {
            name: 'AlloAppart',
            tagline: 'Location immobilière au Sénégal',
            logo_url: `${this.config.get<string>('FRONTEND_URL')}/images/LOGO.png`,
            website_url: this.config.get<string>('FRONTEND_URL'),
          },
          custom_data: { subscription_id: subscriptionId },
        },
        {
          headers: {
            'PAYDUNYA-MASTER-KEY': masterKey,
            'PAYDUNYA-PRIVATE-KEY': privateKey,
            'PAYDUNYA-TOKEN': token,
            'Content-Type': 'application/json',
          },
        },
      )
      .catch((err: unknown) => {
        const axiosErr = err as { response?: { status: number; data: unknown }; message?: string };
        this.logger.error(
          `PayDunya create-invoice ERREUR — status: ${axiosErr.response?.status ?? 'N/A'} — body: ${JSON.stringify(axiosErr.response?.data ?? axiosErr.message)}`,
        );
        throw new BadRequestException('Payment service unavailable');
      });

    if (response.data.response_code !== '00') {
      this.logger.error(
        `PayDunya response_code inattendu : ${JSON.stringify(response.data)}`,
      );
      throw new BadRequestException('Payment service unavailable');
    }

    const invoiceUrl = response.data.response_text;
    if (!invoiceUrl) {
      this.logger.error(
        `PayDunya response_text absent malgré response_code 00 — réponse : ${JSON.stringify(response.data)}`,
      );
      throw new BadRequestException('Payment service unavailable');
    }

    const paymentRef = `PD-${response.data.token}`;
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { paymentRef },
    });

    return { payment_url: invoiceUrl, transId: paymentRef, paymentToken: response.data.token };
  }

  /**
   * Vérification active de l'abonnement — appelée depuis l'UI de paiement
   * custom (SOFTPAY) après paiement via Orange Money / Wave / Free Money.
   */
  async verifySubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return { active: false };
    if (sub.status === SubscriptionStatus.ACTIVE) return { active: true };
    if (!sub.paymentRef?.startsWith('PD-')) return { active: false };

    const token = sub.paymentRef.replace('PD-', '');
    const confirm = await this.softpay.confirmInvoiceStatus(token);
    if (!confirm || confirm.status !== 'completed') return { active: false };

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.ACTIVE, startDate: now, endDate },
    });
    return { active: true };
  }

  /**
   * Webhook IPN PayDunya pour les abonnements PRO_AGENCE. Comme pour les
   * réservations et le boost : le payload entrant n'est jamais une source de
   * vérité — `verifyAndParseCallback` vérifie le hash, puis on rappelle
   * `confirmInvoiceStatus` nous-mêmes auprès de PayDunya pour connaître le
   * statut réel.
   */
  async handlePaydunyaWebhook(rawBody: Record<string, unknown>) {
    const { token, customData } = this.softpay.verifyAndParseCallback(rawBody);

    const subscriptionId = customData['subscription_id'];
    if (typeof subscriptionId !== 'string' || !subscriptionId) return { ok: true };

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription || subscription.status === SubscriptionStatus.ACTIVE) {
      return { ok: true };
    }

    const confirm = await this.softpay.confirmInvoiceStatus(token);
    if (!confirm) {
      throw new BadRequestException('Impossible de confirmer le paiement PayDunya');
    }

    if (confirm.status === 'completed') {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate: now,
          endDate,
          paymentRef: `PD-${token}`,
        },
      });
    }
    // 'cancelled' / 'failed' / 'pending' — l'abonnement reste SUSPENDED,
    // rien à faire de plus ici (pas d'état "échoué" dédié côté abonnement).
    return { ok: true };
  }

  async findMine(userId: string) {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  // Retourne le nombre de jours restants et le niveau d'alerte
  async getAlert(userId: string): Promise<{
    daysLeft: number | null;
    level: 'ok' | 'warning' | 'critical' | 'expired' | 'none';
  }> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });

    if (!sub || sub.status === SubscriptionStatus.CANCELLED) {
      return { daysLeft: null, level: 'none' };
    }

    if (sub.status === SubscriptionStatus.SUSPENDED) {
      return { daysLeft: null, level: 'expired' };
    }

    if (!sub.endDate) return { daysLeft: null, level: 'ok' };

    const msLeft   = sub.endDate.getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    let level: 'ok' | 'warning' | 'critical' | 'expired';
    if (daysLeft <= 0)  level = 'expired';
    else if (daysLeft <= 3)  level = 'critical';
    else if (daysLeft <= 7)  level = 'warning';
    else                     level = 'ok';

    return { daysLeft: Math.max(0, daysLeft), level };
  }

  // Cron quotidien à minuit — suspend les abonnements expirés + cascade sur les annonces
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async suspendExpiredSubscriptions(): Promise<void> {
    // 1. Trouver les abonnements expirés (avant de les mettre à jour pour récupérer les userId)
    const expired = await this.prisma.subscription.findMany({
      where: {
        status:  SubscriptionStatus.ACTIVE,
        endDate: { lt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (expired.length === 0) return;

    const ids     = expired.map((s) => s.id);
    const userIds = expired.map((s) => s.userId);

    // 2. Suspendre les abonnements
    const { count: subCount } = await this.prisma.subscription.updateMany({
      where: { id: { in: ids } },
      data:  { status: SubscriptionStatus.SUSPENDED },
    });

    // 3. Cascade : suspendre les annonces actives des propriétaires concernés
    const { count: listingCount } = await this.prisma.listing.updateMany({
      where: {
        ownerId: { in: userIds },
        status:  ListingStatus.ACTIVE,
      },
      data: { status: ListingStatus.SUSPENDED },
    });

    this.logger.warn(
      `Cron suspension : ${subCount} abonnement(s) expiré(s), ${listingCount} annonce(s) suspendues`,
    );
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!sub) throw new BadRequestException("No subscription found");
    return this.prisma.subscription.update({
      where: { userId },
      data: { status: SubscriptionStatus.CANCELLED },
    });
  }

  async findAll(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              agencyName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscription.count(),
    ]);
    return { data, total, page, limit };
  }

  async suspendById(id: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.SUSPENDED },
    });
  }

  async activateById(id: string) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.ACTIVE, startDate: now, endDate },
    });
  }

  async extendById(id: string, days = 30) {
    const sub = await this.prisma.subscription.findUniqueOrThrow({ where: { id } });
    const currentEnd = sub.endDate ?? new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + days);
    return this.prisma.subscription.update({
      where: { id },
      data: { endDate: newEnd, status: SubscriptionStatus.ACTIVE },
    });
  }
}
