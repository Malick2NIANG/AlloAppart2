import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { CompleteVerificationDto } from './dto/complete-verification.dto';
import { RateVerificationDto } from './dto/rate-verification.dto';
import {
  type User,
  Role,
  VerifStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';

// Durée de validité du badge AlloVérifié — Article 6 des CGU (6 mois)
const BADGE_VALIDITY_MONTHS = 6;

// Tarifs AlloVérifié pour les demandeurs non couverts par un abonnement PRO
// actif (STARTER, bailleur individuel) — gratuit et illimité pour PRO actif
// et pour les admins. Cf. confirmation utilisateur du 2026-09-10 : même
// logique que le boost, "PRO gratuit, reste payant 25k/60k".
export const AUDIT_PRICE_XOF: Record<'BASIC' | 'FULL', number> = {
  BASIC: 25_000,
  FULL: 60_000,
};

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationsService,
    private readonly config: ConfigService,
    private readonly softpay: PaydunyaSoftpayService,
  ) {}

  /** Abonnement PRO_AGENCE + plan PRO + statut ACTIVE — cf. isProActive() dans listings.service.ts. */
  private isProActive(user: {
    roles: Role[];
    subscription: { plan: SubscriptionPlan; status: SubscriptionStatus } | null;
  }): boolean {
    return (
      user.roles.includes(Role.PRO_AGENCE) &&
      user.subscription?.plan === SubscriptionPlan.PRO &&
      user.subscription?.status === SubscriptionStatus.ACTIVE
    );
  }

  async create(requesterId: string, dto: CreateVerificationDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) throw new NotFoundException('Listing not found');

    const isOwner = listing.ownerId === requesterId;
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
      include: { subscription: true },
    });
    const isAdmin = requester.roles.includes(Role.ADMIN);

    if (!isOwner && !isAdmin) throw new ForbiddenException('Not authorized');

    // Bloquer les doublons : une seule verif active par annonce
    const existing = await this.prisma.verification.findFirst({
      where: {
        listingId: dto.listingId,
        status: { in: [VerifStatus.REQUESTED, VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Une vérification est déjà en cours pour cette annonce. Attendez qu\'elle soit terminée avant d\'en soumettre une nouvelle.',
      );
    }

    // Gratuit et illimité : admin ou abonnement PRO actif (cf. AUDIT_PRICE_XOF ci-dessus).
    if (isAdmin || this.isProActive(requester)) {
      return this.prisma.verification.create({
        data: {
          listingId: dto.listingId,
          auditType: dto.auditType,
          scheduledAt: new Date(dto.scheduledAt),
          status: VerifStatus.REQUESTED,
          ...(dto.preferredAgentId ? { preferredAgentId: dto.preferredAgentId } : {}),
        },
      });
    }

    // Tout le reste (STARTER, bailleur individuel) : paiement PayDunya requis
    // avant que la Verification ne soit réellement créée.
    const existingPendingPayment = await this.prisma.verificationPayment.findFirst({
      where: { listingId: dto.listingId, status: 'PENDING' },
    });
    if (existingPendingPayment) {
      throw new ConflictException(
        'Un paiement AlloVérifié est déjà en attente pour cette annonce.',
      );
    }

    return this.initiatePaymentWithPayDunya(requesterId, dto);
  }

  private async initiatePaymentWithPayDunya(
    requesterId: string,
    dto: CreateVerificationDto,
  ) {
    const amount = AUDIT_PRICE_XOF[dto.auditType];
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    // ── Mode bypass dev : simule le paiement sans appeler PayDunya ──────────
    if (isDev && this.config.get<string>('PAYDUNYA_DEV_BYPASS') === 'true') {
      this.logger.warn(
        `[DEV BYPASS] Paiement AlloVérifié direct pour l'annonce ${dto.listingId} (${amount} FCFA — ${dto.auditType})`,
      );
      const paymentRef = `DEV-VERIF-${Date.now()}`;
      const payment = await this.prisma.verificationPayment.create({
        data: {
          listingId: dto.listingId,
          requesterId,
          auditType: dto.auditType,
          scheduledAt: new Date(dto.scheduledAt),
          preferredAgentId: dto.preferredAgentId,
          amount,
          paymentRef,
          status: 'CONFIRMED',
        },
      });
      const verification = await this.createVerificationFromPayment(payment.id);
      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      return {
        payment_url: `${frontendUrl}/bailleur/listings?status=verif_success`,
        transId: paymentRef,
        verification,
      };
    }
    // ────────────────────────────────────────────────────────────────────────

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
        baseUrl + '/checkout-invoice/create',
        {
          invoice: {
            total_amount: amount,
            description: `AlloVérifié ${dto.auditType} -- AlloAppart`,
            return_url:
              this.config.get<string>('FRONTEND_URL') +
              '/bailleur/listings?status=verif_success',
            cancel_url:
              this.config.get<string>('FRONTEND_URL') +
              '/bailleur/listings?status=verif_cancel',
            callback_url:
              this.config.get<string>('BACKEND_URL') +
              '/api/v1/verifications/webhook/paydunya',
          },
          store: {
            name: 'AlloAppart',
            tagline: 'Location immobilière au Sénégal',
            logo_url: `${this.config.get<string>('FRONTEND_URL')}/images/LOGO.png`,
            website_url: this.config.get<string>('FRONTEND_URL'),
          },
          custom_data: { listing_id: dto.listingId },
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
        const axiosErr = err as {
          response?: { status: number; data: unknown };
          message?: string;
        };
        this.logger.error(
          `PayDunya AlloVérifié ERREUR — status: ${axiosErr.response?.status ?? 'N/A'} — body: ${JSON.stringify(axiosErr.response?.data ?? axiosErr.message)}`,
        );
        throw new BadRequestException('Payment service unavailable');
      });

    if (response.data.response_code !== '00') {
      this.logger.error(
        `PayDunya AlloVérifié response_code inattendu : ${JSON.stringify(response.data)}`,
      );
      throw new BadRequestException('Payment service unavailable');
    }
    const invoiceUrl = response.data.response_text;
    if (!invoiceUrl) {
      this.logger.error(
        `PayDunya AlloVérifié response_text absent — réponse : ${JSON.stringify(response.data)}`,
      );
      throw new BadRequestException('Payment service unavailable');
    }
    const paymentRef = 'PD-' + response.data.token;
    await this.prisma.verificationPayment.create({
      data: {
        listingId: dto.listingId,
        requesterId,
        auditType: dto.auditType,
        scheduledAt: new Date(dto.scheduledAt),
        preferredAgentId: dto.preferredAgentId,
        amount,
        paymentRef,
        status: 'PENDING',
      },
    });
    return {
      payment_url: invoiceUrl,
      transId: paymentRef,
      paymentToken: response.data.token,
    };
  }

  /** Crée la Verification réelle une fois le paiement confirmé, et trace le lien sur le paiement. */
  private async createVerificationFromPayment(paymentId: string) {
    const payment = await this.prisma.verificationPayment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    if (payment.verificationId) {
      // Déjà traité (idempotence — double webhook/vérif active)
      return this.prisma.verification.findUnique({
        where: { id: payment.verificationId },
      });
    }
    const verification = await this.prisma.verification.create({
      data: {
        listingId: payment.listingId,
        auditType: payment.auditType,
        scheduledAt: payment.scheduledAt,
        status: VerifStatus.REQUESTED,
        ...(payment.preferredAgentId ? { preferredAgentId: payment.preferredAgentId } : {}),
      },
    });
    await this.prisma.verificationPayment.update({
      where: { id: payment.id },
      data: { verificationId: verification.id },
    });
    return verification;
  }

  /**
   * Webhook IPN PayDunya pour AlloVérifié. Comme pour le boost : le payload
   * entrant n'est jamais une source de vérité — `verifyAndParseCallback`
   * vérifie le hash, puis on rappelle `confirmInvoiceStatus` nous-mêmes
   * auprès de PayDunya pour connaître le statut réel.
   */
  async handleWebhookPayDunya(rawBody: Record<string, unknown>) {
    const { token, customData } = this.softpay.verifyAndParseCallback(rawBody);

    const listingId = customData['listing_id'];
    if (typeof listingId !== 'string' || !listingId) return { ok: true };

    const vp = await this.prisma.verificationPayment.findFirst({
      where: { listingId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!vp) return { ok: true }; // déjà traité (idempotence) ou inconnu

    const confirm = await this.softpay.confirmInvoiceStatus(token);
    if (!confirm) {
      throw new BadRequestException(
        'Impossible de confirmer le paiement PayDunya',
      );
    }

    if (confirm.status === 'completed') {
      await this.prisma.verificationPayment.update({
        where: { id: vp.id },
        data: { status: 'CONFIRMED', paymentRef: 'PD-' + token },
      });
      await this.createVerificationFromPayment(vp.id);
    } else if (confirm.status === 'cancelled' || confirm.status === 'failed') {
      await this.prisma.verificationPayment.update({
        where: { id: vp.id },
        data: { status: 'FAILED' },
      });
    }
    // status === 'pending' — on attend le prochain callback ou la vérification active.

    return { ok: true };
  }

  async findOne(id: string, agentId: string) {
    const v = await this.prisma.verification.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true, title: true, city: true, address: true, images: true,
            lat: true, lng: true,
            owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!v) throw new NotFoundException('Mission not found');
    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');
    return v;
  }

  async findAllForAgent(agentId: string) {
    return this.prisma.verification.findMany({
      where: { agentId },
      include: {
        listing: { select: { id: true, title: true, city: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAssigned(agentId: string) {
    return this.prisma.verification.findMany({
      where: {
        agentId,
        status: { in: [VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
      },
      include: {
        listing: {
          select: {
            id: true, title: true, city: true, address: true, images: true,
            owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAgentHistory(agentId: string) {
    return this.prisma.verification.findMany({
      where: {
        agentId,
        status: { in: [VerifStatus.DONE, VerifStatus.REJECTED] },
      },
      include: {
        listing: { select: { id: true, title: true, city: true, images: true } },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async agentStats(agentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [assigned, inProgress, doneThisMonth, doneTotal, todayMissions, ratings] = await Promise.all([
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.SCHEDULED } }),
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.IN_PROGRESS } }),
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.DONE, completedAt: { gte: monthStart } } }),
      this.prisma.verification.count({ where: { agentId, status: VerifStatus.DONE } }),
      this.prisma.verification.findMany({
        where: {
          agentId,
          scheduledAt: { gte: today, lt: new Date(today.getTime() + 86400000) },
          status: { in: [VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
        },
        include: { listing: { select: { id: true, title: true, city: true, address: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.agentRating.findMany({
        where: { agentId },
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          rater: { select: { firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalRatings = await this.prisma.agentRating.count({ where: { agentId } });
    const ratingSum    = await this.prisma.agentRating.aggregate({ where: { agentId }, _avg: { rating: true } });
    const avgRating    = ratingSum._avg.rating ? Math.round(ratingSum._avg.rating * 10) / 10 : null;

    return {
      assigned,
      inProgress,
      doneThisMonth,
      doneTotal,
      todayMissions,
      avgRating,
      totalRatings,
      recentRatings: ratings.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        raterFirstName: r.rater.firstName,
        raterLastName: r.rater.lastName,
        raterAvatar: r.rater.avatar,
      })),
    };
  }

  async findByRequester(userId: string) {
    return this.prisma.verification.findMany({
      where: { listing: { ownerId: userId } },
      include: {
        listing: { select: { id: true, title: true, city: true, images: true } },
        agent: { select: { id: true, firstName: true, lastName: true, phone: true, avatar: true, bio: true } },
        rating: { select: { id: true, rating: true, comment: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPending() {
    return this.prisma.verification.findMany({
      where: {
        status: {
          in: [
            VerifStatus.REQUESTED,
            VerifStatus.SCHEDULED,
            VerifStatus.IN_PROGRESS,
          ],
        },
      },
      include: {
        listing: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
        agent: true,
        preferredAgent: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async pendingCount(): Promise<{ count: number }> {
    const count = await this.prisma.verification.count({
      where: { status: VerifStatus.REQUESTED },
    });
    return { count };
  }

  async decline(id: string, agentId: string, reason: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });

    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');
    if (v.status !== VerifStatus.SCHEDULED) {
      throw new BadRequestException('Only scheduled missions can be declined.');
    }

    // Met en attente d'approbation admin (ne prend pas effet immédiatement)
    const updated = await this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.DECLINE_PENDING, declineReason: reason },
    });

    // Notif admin — l'agent demande à décliner
    void this.notif.notifyAdminDeclineRequest(v.listing.title, id, v.listingId);

    return updated;
  }

  async approveDecline(id: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });
    if (v.status !== VerifStatus.DECLINE_PENDING) {
      throw new BadRequestException('This verification is not pending decline.');
    }
    const updated = await this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.REQUESTED, agentId: null },
    });
    void this.notif.notifyVerifDeclined(v.listing.owner.id, v.listing.title, id, v.listingId);
    return updated;
  }

  async refuseDecline(id: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({ where: { id } });
    if (v.status !== VerifStatus.DECLINE_PENDING) {
      throw new BadRequestException('This verification is not pending decline.');
    }
    return this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.SCHEDULED, declineReason: null },
    });
  }

  async assignAgent(verificationId: string, agentId: string) {
    const v = await this.prisma.verification.update({
      where: { id: verificationId },
      data: { agentId, status: VerifStatus.SCHEDULED },
      include: {
        listing: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        agent:   { select: { firstName: true, lastName: true } },
      },
    });

    const listingTitle = v.listing.title;
    const agentName    = `${v.agent?.firstName ?? ''} ${v.agent?.lastName ?? ''}`.trim();
    const bailleurId   = v.listing.owner.id;

    // Notif agent — nouvelle mission
    void this.notif.notifyVerifAssigned(agentId, listingTitle, verificationId, v.listingId);
    // Notif bailleur — agent confirmé
    void this.notif.notifyVerifScheduled(bailleurId, listingTitle, agentName, verificationId, v.listingId);

    return v;
  }

  async start(id: string, agentId: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });

    if (!v.agentId) throw new ForbiddenException('No agent assigned');
    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');

    // Bloquer si la visite est planifiée dans plus de 15 minutes
    const earliest = new Date(v.scheduledAt.getTime() - 15 * 60 * 1000);
    if (new Date() < earliest) {
      throw new BadRequestException(
        `La visite ne peut démarrer qu'à partir de ${earliest.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      );
    }

    const updated = await this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.IN_PROGRESS },
    });

    // Notif bailleur — visite démarrée
    void this.notif.notifyVerifInProgress(v.listing.owner.id, v.listing.title, id, v.listingId);

    return updated;
  }

  async complete(id: string, agentId: string, dto: CompleteVerificationDto) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: { select: { id: true } } } } },
    });

    if (!v.agentId) throw new ForbiddenException('No agent assigned');
    if (v.agentId !== agentId) throw new ForbiddenException('Not authorized');
    if (v.status !== VerifStatus.IN_PROGRESS)
      throw new BadRequestException('Visit must be started before certifying the property');

    await this.prisma.listing.update({
      where: { id: v.listingId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        ...(dto.tourUrl ? { tourUrl: dto.tourUrl } : {}),
      },
    });

    const updated = await this.prisma.verification.update({
      where: { id },
      data: {
        status: VerifStatus.DONE,
        completedAt: new Date(),
        reportUrl: dto.reportUrl,
        notes: dto.notes,
        photos: dto.photos ?? [],
      },
    });

    // Notif bailleur — visite terminée
    void this.notif.notifyVerifDone(v.listing.owner.id, v.listing.title, id, v.listingId);

    return updated;
  }

  async findAll(page = 1, limit = 20, status?: VerifStatus) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.verification.findMany({
        where,
        include: {
          listing: {
            select: {
              id: true, title: true, city: true,
              owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            },
          },
          agent: { select: { id: true, firstName: true, lastName: true } },
          preferredAgent: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.verification.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async validate(id: string, adminId: string) {
    const admin = await this.prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }

    const v = await this.prisma.verification.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Verification not found');

    if (v.status !== VerifStatus.DONE) {
      throw new BadRequestException(
        'Le badge AlloVérifié ne peut être accordé que sur une visite terminée par l\'agent (statut DONE).',
      );
    }

    const listing = await this.prisma.listing.update({
      where: { id: v.listingId },
      data: { isVerified: true, verifiedAt: new Date() },
      include: { owner: { select: { id: true } } },
    });

    // Notif bailleur — badge accordé
    void this.notif.notifyVerifValidated(listing.owner.id, listing.title, id, v.listingId);

    return { validated: true };
  }

  async reject(id: string, user: User, reason: string) {
    const v = await this.prisma.verification.findUniqueOrThrow({
      where: { id },
    });

    const isAgent = v.agentId !== null && v.agentId === user.id;
    const isAdmin = user.roles.includes(Role.ADMIN);

    if (!isAgent && !isAdmin) throw new ForbiddenException('Not authorized');

    // Contrairement à decline() (restreint à SCHEDULED), reject() n'avait
    // aucune contrainte de statut : un agent assigné pouvait rejeter — et
    // donc écraser notes/status — une vérification déjà DONE, y compris
    // après que le bailleur l'ait notée via rate(). On aligne sur le même
    // principe : seules les missions encore en cours peuvent être rejetées.
    if (
      v.status !== VerifStatus.REQUESTED &&
      v.status !== VerifStatus.SCHEDULED &&
      v.status !== VerifStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'Seules les vérifications en cours peuvent être rejetées.',
      );
    }

    return this.prisma.verification.update({
      where: { id },
      data: { status: VerifStatus.REJECTED, notes: reason },
    });
  }

  async rate(verificationId: string, raterId: string, dto: RateVerificationDto) {
    // Vérifier que la verif existe et est DONE
    const v = await this.prisma.verification.findUnique({
      where: { id: verificationId },
      include: { listing: { select: { ownerId: true } } },
    });

    if (!v) throw new NotFoundException('Verification not found');
    if (v.status !== VerifStatus.DONE) {
      throw new BadRequestException('Rating is only available after a completed visit (status DONE).');
    }
    if (v.listing.ownerId !== raterId) {
      throw new ForbiddenException('Seul le bailleur de l\'annonce peut noter l\'agent.');
    }
    if (!v.agentId) {
      throw new BadRequestException('No agent assigned to this verification.');
    }

    // Upsert — un seul avis par vérification
    return this.prisma.agentRating.upsert({
      where: { verificationId },
      create: {
        verificationId,
        agentId: v.agentId,
        raterId,
        rating: dto.rating,
        comment: dto.comment,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  // IDOR corrigée : seuls le bailleur qui a demandé la vérification (auteur
  // potentiel de la note), l'agent noté, ou un admin peuvent lire une note —
  // sinon n'importe quel utilisateur connecté pouvait lire les commentaires
  // qu'un bailleur a laissés sur un agent, sur n'importe quelle vérification.
  async findRatingByVerification(verificationId: string, user: User) {
    const v = await this.prisma.verification.findUnique({
      where: { id: verificationId },
      include: { listing: { select: { ownerId: true } } },
    });
    if (!v) throw new NotFoundException('Verification not found');

    const isOwner = v.listing.ownerId === user.id;
    const isRatedAgent = v.agentId === user.id;
    const isAdmin = user.roles.includes(Role.ADMIN);
    if (!isOwner && !isRatedAgent && !isAdmin) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.agentRating.findUnique({ where: { verificationId } });
  }

  /**
   * Cron quotidien à minuit — retire le badge AlloVérifié™ des annonces dont
   * la vérification date de plus de 6 mois (Article 6 des CGU). Le bailleur
   * doit alors solliciter et régler une nouvelle vérification pour le
   * renouveler.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireOldBadges(): Promise<void> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - BADGE_VALIDITY_MONTHS);

    const { count } = await this.prisma.listing.updateMany({
      where: { isVerified: true, verifiedAt: { lt: cutoff } },
      data: { isVerified: false },
    });

    if (count > 0) {
      this.logger.log(`Badge AlloVérifié expiré sur ${count} annonce(s) (vérification > ${BADGE_VALIDITY_MONTHS} mois)`);
    }
  }
}
