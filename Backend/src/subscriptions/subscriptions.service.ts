import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan, SubscriptionStatus, User } from '@prisma/client';
import axios from 'axios';
import { PaydunyaWebhookDto } from '../payments/dto/paydunya-webhook.dto';

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
    const masterKey = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token = this.config.get<string>('PAYDUNYA_TOKEN');

    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException('Service de paiement indisponible');
    }

    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const response = await axios
      .post<{ response_code: string; token: string; invoice_url: string }>(
        `${baseUrl}/checkout-invoice/create`,
        {
          invoice: {
            total_amount: amount,
            description: `Abonnement ${plan} -- AlloAppart`,
            return_url: `${this.config.get<string>('FRONTEND_URL')}/bailleur/abonnement?status=success`,
            cancel_url: `${this.config.get<string>('FRONTEND_URL')}/bailleur/abonnement?status=cancel`,
            callback_url: `${this.config.get<string>('BACKEND_URL')}/api/v1/subscriptions/webhook/paydunya`,
          },
          store: { name: 'AlloAppart' },
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
      .catch(() => {
        throw new BadRequestException('Service de paiement indisponible');
      });

    if (response.data.response_code !== '00') {
      throw new BadRequestException('Service de paiement indisponible');
    }

    const paymentRef = `PD-${response.data.token}`;
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { paymentRef },
    });

    return { payment_url: response.data.invoice_url, transId: paymentRef };
  }

  async handlePaydunyaWebhook(dto: PaydunyaWebhookDto) {
    const masterKey = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token = this.config.get<string>('PAYDUNYA_TOKEN');
    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException('PAYDUNYA_* manquant');
    }

    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const confirm = await axios
      .get<{
        response_code: string;
        status: string;
        custom_data: { subscription_id: string };
      }>(`${baseUrl}/checkout-invoice/confirm/${dto.data}`, {
        headers: {
          'PAYDUNYA-MASTER-KEY': masterKey,
          'PAYDUNYA-PRIVATE-KEY': privateKey,
          'PAYDUNYA-TOKEN': token,
        },
      })
      .catch(() => {
        throw new BadRequestException(
          'Impossible de confirmer le paiement PayDunya',
        );
      });

    const { status, custom_data } = confirm.data;
    const subscriptionId = custom_data?.subscription_id;
    if (!subscriptionId) return { ok: true };

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription || subscription.status === SubscriptionStatus.ACTIVE) {
      return { ok: true };
    }

    if (status === 'completed') {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate: now,
          endDate,
          paymentRef: `PD-${dto.data}`,
        },
      });
    }
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

  // Cron quotidien à minuit — suspend les abonnements expirés
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async suspendExpiredSubscriptions(): Promise<void> {
    const { count } = await this.prisma.subscription.updateMany({
      where: {
        status:  SubscriptionStatus.ACTIVE,
        endDate: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.SUSPENDED },
    });

    if (count > 0) {
      this.logger.warn(`Cron suspension : ${count} abonnement(s) expiré(s) suspendu(s)`);
    }
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!sub) throw new BadRequestException("Pas d'abonnement trouve");
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
