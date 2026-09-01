import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '../search/search.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { ListingStatus, Role, SubscriptionPlan, SubscriptionStatus, User } from '@prisma/client';
import { CreateReportDto } from './dto/create-report.dto';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';

const BOOST_PRICE_XOF = 5_000;
const BOOST_DAYS = 7;
const BOOST_SCORE_GAIN = 10;
const BOOST_SCORE_MAX = 100;
const STARTER_MAX_LISTINGS = 10;

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly softpay: PaydunyaSoftpayService,
  ) {}

  /**
   * Statistiques publiques affichées sur la page d'accueil (section "hero").
   * Calculées en direct depuis la base — jamais de chiffres inventés/codés
   * en dur, pour éviter d'afficher des données trompeuses aux visiteurs.
   */
  async getPublicStats(): Promise<{
    activeListings: number;
    regionsCount: number;
    verifiedPercent: number;
  }> {
    const [activeListings, verifiedListings, regionGroups] = await Promise.all([
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.listing.count({
        where: { status: ListingStatus.ACTIVE, isVerified: true },
      }),
      this.prisma.listing.groupBy({
        by: ['region'],
        where: { status: ListingStatus.ACTIVE },
      }),
    ]);

    const verifiedPercent =
      activeListings > 0
        ? Math.round((verifiedListings / activeListings) * 100)
        : 0;

    return {
      activeListings,
      regionsCount: regionGroups.length,
      verifiedPercent,
    };
  }

  async findAll(filters: FilterListingsDto) {
    const {
      q,
      region,
      city,
      type,
      minPrice,
      maxPrice,
      isVerified,
      minRooms,
      maxRooms,
      minSurface,
      maxSurface,
      amenities,
      ownerType,
      page = 1,
      limit = 20,
    } = filters;

    const where = {
      status: ListingStatus.ACTIVE,
      ...(region && { region }),
      ...(city && { city }),
      ...(type && { type }),
      ...(isVerified !== undefined && { isVerified }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          }
        : {}),
      ...(minRooms !== undefined || maxRooms !== undefined
        ? {
            rooms: {
              ...(minRooms !== undefined && { gte: minRooms }),
              ...(maxRooms !== undefined && { lte: maxRooms }),
            },
          }
        : {}),
      ...(minSurface !== undefined || maxSurface !== undefined
        ? {
            surface: {
              ...(minSurface !== undefined && { gte: minSurface }),
              ...(maxSurface !== undefined && { lte: maxSurface }),
            },
          }
        : {}),
      ...(amenities &&
        amenities.length > 0 && { amenities: { hasEvery: amenities } }),
      // Filtre par type de propriétaire
      ...(ownerType === 'AGENCE' && {
        owner: { roles: { has: Role.PRO_AGENCE } },
      }),
      ...(ownerType === 'PARTICULIER' && {
        NOT: { owner: { roles: { has: Role.PRO_AGENCE } } },
      }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
          { region: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    };

    // Fetch all matching records + owner subscription pour tri priorité
    // (pagination appliquée en mémoire après tri)
    const allData = await this.prisma.listing.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true, firstName: true, lastName: true,
            agencyName: true, agencySlug: true, avatar: true, roles: true,
            subscription: { select: { plan: true, status: true } },
          },
        },
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // ── Calcul du score de visibilité ─────────────────────────────────
    // PRO_AGENCE PRO actif : +200 | PRO_AGENCE STARTER actif : +100
    // Bailleur boosté (boostUntil > maintenant) : +50
    // + boostScore existant (achats de boost)
    const now = new Date();
    const scored = allData.map((listing) => {
      let priority = listing.boostScore;
      const ownerRoles = listing.owner?.roles ?? [];
      const sub = listing.owner?.subscription;
      const isProAgence = ownerRoles.includes(Role.PRO_AGENCE);

      if (isProAgence && sub?.plan === SubscriptionPlan.PRO && sub.status === SubscriptionStatus.ACTIVE) {
        priority += 200;
      } else if (isProAgence && sub?.plan === SubscriptionPlan.STARTER && sub.status === SubscriptionStatus.ACTIVE) {
        priority += 100;
      } else if (listing.boostUntil && listing.boostUntil > now) {
        priority += 50;
      }

      return { listing, priority };
    });

    // Tri par score décroissant, puis par date de création décroissante
    scored.sort((a, b) => b.priority - a.priority || b.listing.createdAt.getTime() - a.listing.createdAt.getTime());

    const total = scored.length;
    const page_ = page;
    const paginated = scored.slice((page_ - 1) * limit, page_ * limit);

    const enriched = paginated.map(({ listing }) => {
      const ratings = listing.reviews.map((r) => r.rating);
      const avgRating =
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10,
            ) / 10
          : null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { reviews: _reviews, ...rest } = listing;
      return { ...rest, avgRating };
    });

    return { data: enriched, total, page, limit };
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true, firstName: true, lastName: true,
            agencyName: true, agencySlug: true, avatar: true, roles: true,
          },
        },
        _count: { select: { reviews: true } },
        reviews: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        verifications: {
          select: {
            status: true,
            auditType: true,
            scheduledAt: true,
            completedAt: true,
            notes: true,
            reportUrl: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async findSimilar(id: string) {
    const { region, type } = await this.prisma.listing.findUniqueOrThrow({
      where: { id },
      select: { region: true, type: true },
    });
    return this.prisma.listing.findMany({
      where: { id: { not: id }, region, type, status: ListingStatus.ACTIVE },
      take: 6,
      orderBy: { boostScore: 'desc' },
    });
  }

  /**
   * Ne garde dans l'index de recherche (Meilisearch) que les annonces
   * ACTIVE — sinon un brouillon ou une annonce archivée/dépubliée par son
   * propriétaire reste trouvable via la recherche publique. `indexListing()`
   * fait un upsert inconditionnel sans champ `status`, donc l'appelant doit
   * décider lui-même d'indexer ou de retirer.
   */
  private syncSearchIndex(listing: { id: string; status: ListingStatus }): void {
    if (listing.status === ListingStatus.ACTIVE) {
      void this.search.indexListing(listing as never).catch(() => undefined);
    } else {
      void this.search.deleteListingFromIndex(listing.id).catch(() => undefined);
    }
  }

  /**
   * Vérifie qu'un propriétaire PRO_AGENCE a le droit de publier une annonce
   * de plus (abonnement actif + respect du plafond STARTER). Centralisé ici
   * car trois chemins mènent à un statut ACTIVE — create(), publishListing()
   * et update() — et doivent tous appliquer la même règle : sinon un bailleur
   * peut créer une annonce en DRAFT (autorisé sans abonnement) puis la publier
   * via un chemin qui ne vérifie rien, contournant complètement l'abonnement.
   */
  private async assertCanPublish(ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      include: { subscription: true },
    });
    if (!owner.roles.includes(Role.PRO_AGENCE)) return;

    if (owner.subscription?.status !== SubscriptionStatus.ACTIVE) {
      throw new ForbiddenException(
        'Un abonnement actif est requis pour publier des annonces',
      );
    }
    if (owner.subscription.plan === SubscriptionPlan.STARTER) {
      const count = await this.prisma.listing.count({ where: { ownerId } });
      if (count >= STARTER_MAX_LISTINGS) {
        throw new BadRequestException(
          `Le plan STARTER est limité à ${STARTER_MAX_LISTINGS} annonces. Passez au plan PRO pour publier davantage.`,
        );
      }
    }
  }

  async create(ownerId: string, dto: CreateListingDto) {
    const wantsToPublish = dto.status === ListingStatus.ACTIVE;
    if (wantsToPublish) await this.assertCanPublish(ownerId);

    const listing = await this.prisma.listing.create({
      data: {
        ...dto,
        ownerId,
        status: wantsToPublish ? ListingStatus.ACTIVE : ListingStatus.DRAFT,
      },
    });
    this.syncSearchIndex(listing);
    return listing;
  }

  async update(id: string, user: User, dto: UpdateListingDto) {
    const listing = await this.findOne(id);
    if (listing.ownerId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Not authorized');
    }
    // Defense-in-depth : un appelant interne pourrait passer status=ACTIVE via
    // un cast (le DTO l'exclut, mais on vérifie quand même au runtime).
    const rawDto = dto as Record<string, unknown>;
    if (rawDto['status'] === ListingStatus.ACTIVE && listing.status !== ListingStatus.ACTIVE) {
      await this.assertCanPublish(listing.ownerId);
    }
    const updated = await this.prisma.listing.update({
      where: { id },
      data: dto,
    });
    this.syncSearchIndex(updated);
    return updated;
  }

  /** Archive (corbeille) : DRAFT ou ACTIVE → SUSPENDED, accessible par le bailleur propriétaire */
  async archiveListing(id: string, userId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id } });
    if (listing.ownerId !== userId)
      throw new ForbiddenException('Not authorized');
    if (listing.status === ListingStatus.SUSPENDED)
      throw new BadRequestException('Listing already archived');
    if (listing.status === ListingStatus.RENTED)
      throw new BadRequestException('Cannot archive a rented listing');
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.SUSPENDED },
    });
    this.syncSearchIndex(updated);
    return updated;
  }

  /** Restaure une annonce archivée (SUSPENDED) → DRAFT ou ACTIVE */
  async restoreListing(id: string, userId: string, targetStatus: 'DRAFT' | 'ACTIVE') {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id } });
    if (listing.ownerId !== userId)
      throw new ForbiddenException('Not authorized');
    if (listing.status !== ListingStatus.SUSPENDED)
      throw new BadRequestException('Only archived listings can be restored');
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: targetStatus === 'ACTIVE' ? ListingStatus.ACTIVE : ListingStatus.DRAFT },
    });
    this.syncSearchIndex(updated);
    return updated;
  }

  async unpublishListing(id: string, userId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id } });
    if (listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be unpublished');
    }
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.DRAFT },
    });
    this.syncSearchIndex(updated);
    return updated;
  }

  async publishListing(id: string, userId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id } });
    if (listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be published');
    }
    await this.assertCanPublish(userId);
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.ACTIVE },
    });
    this.syncSearchIndex(updated);
    return updated;
  }

  async activateListing(id: string, user: User) {
    if (
      !user.roles.includes(Role.ADMIN) &&
      !user.roles.includes(Role.AGENT_TERRAIN)
    ) {
      throw new ForbiddenException(
        'Reserve aux administrateurs et agents terrain',
      );
    }
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.ACTIVE },
    });
    this.syncSearchIndex(updated);
    return updated;
  }

  async suspendListing(id: string, user: User) {
    if (!user.roles.includes(Role.ADMIN))
      throw new ForbiddenException('Reserve aux administrateurs');
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.SUSPENDED },
    });
    void this.search.deleteListingFromIndex(id).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user: User) {
    const listing = await this.findOne(id);
    if (listing.ownerId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Not authorized');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. AgentRatings (dépend de Verification)
      const verifications = await tx.verification.findMany({
        where: { listingId: id },
        select: { id: true },
      });
      if (verifications.length > 0) {
        await tx.agentRating.deleteMany({
          where: { verificationId: { in: verifications.map((v) => v.id) } },
        });
      }
      // 2. Verifications
      await tx.verification.deleteMany({ where: { listingId: id } });

      // 3. Reviews
      await tx.review.deleteMany({ where: { listingId: id } });

      // 4. Messages dans les MessageRooms
      const rooms = await tx.messageRoom.findMany({
        where: { listingId: id },
        select: { id: true },
      });
      if (rooms.length > 0) {
        await tx.message.deleteMany({
          where: { roomId: { in: rooms.map((r) => r.id) } },
        });
      }
      // 5. MessageRooms
      await tx.messageRoom.deleteMany({ where: { listingId: id } });

      // 6. Bookings
      await tx.booking.deleteMany({ where: { listingId: id } });

      // 7. BoostPayments
      await tx.boostPayment.deleteMany({ where: { listingId: id } });

      // 8. Listing (many-to-many favoritedBy auto-géré par Prisma)
      await tx.listing.delete({ where: { id } });
    });

    void this.search.deleteListingFromIndex(id).catch(() => undefined);
    return { id };
  }

  async boost(id: string, user: User) {
    const listing = await this.findOne(id);
    if (listing.ownerId !== user.id)
      throw new ForbiddenException('Not authorized');
    return this.initiateBoostWithPayDunya(id);
  }

  private async initiateBoostWithPayDunya(listingId: string) {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    // ── Mode bypass dev : simule le paiement sans appeler PayDunya ──────────
    if (isDev && this.config.get<string>('PAYDUNYA_DEV_BYPASS') === 'true') {
      this.logger.warn(`[DEV BYPASS] Boost direct de l'annonce ${listingId} (${BOOST_PRICE_XOF} FCFA — ${BOOST_DAYS}j)`);
      const boostUntil = new Date();
      boostUntil.setDate(boostUntil.getDate() + BOOST_DAYS);
      const paymentRef = `DEV-BOOST-${Date.now()}`;
      await this.prisma.boostPayment.create({
        data: { listingId, paymentRef, status: 'PAID', durationDays: BOOST_DAYS },
      });
      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          boostUntil,
          boostScore: { increment: BOOST_SCORE_GAIN },
        },
      });
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      return {
        payment_url: `${frontendUrl}/bailleur/listings?status=boost_success`,
        transId: paymentRef,
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
            total_amount: BOOST_PRICE_XOF,
            description: 'Boost annonce ' + BOOST_DAYS + 'j -- AlloAppart',
            return_url:
              this.config.get<string>('FRONTEND_URL') +
              '/bailleur/listings?status=boost_success',
            cancel_url:
              this.config.get<string>('FRONTEND_URL') +
              '/bailleur/listings?status=boost_cancel',
            callback_url:
              this.config.get<string>('BACKEND_URL') +
              '/api/v1/listings/webhook/boost/paydunya',
          },
          store: {
            name: 'AlloAppart',
            tagline: 'Location immobilière au Sénégal',
            logo_url: `${this.config.get<string>('FRONTEND_URL')}/images/LOGO.png`,
            website_url: this.config.get<string>('FRONTEND_URL'),
          },
          custom_data: { listing_id: listingId },
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
          `PayDunya boost ERREUR — status: ${axiosErr.response?.status ?? 'N/A'} — body: ${JSON.stringify(axiosErr.response?.data ?? axiosErr.message)}`,
        );
        throw new BadRequestException('Payment service unavailable');
      });

    if (response.data.response_code !== '00') {
      this.logger.error(`PayDunya boost response_code inattendu : ${JSON.stringify(response.data)}`);
      throw new BadRequestException('Payment service unavailable');
    }
    // PayDunya retourne l'URL dans response_text (pas invoice_url)
    const invoiceUrl = response.data.response_text;
    if (!invoiceUrl) {
      this.logger.error(`PayDunya boost response_text absent — réponse : ${JSON.stringify(response.data)}`);
      throw new BadRequestException('Payment service unavailable');
    }
    const paymentRef = 'PD-' + response.data.token;
    await this.prisma.boostPayment.create({
      data: {
        listingId,
        paymentRef,
        status: 'PENDING',
        durationDays: BOOST_DAYS,
      },
    });
    return { payment_url: invoiceUrl, transId: paymentRef, paymentToken: response.data.token };
  }

  private applyBoost(listingId: string, boostScore: number) {
    const boostUntil = new Date();
    boostUntil.setDate(boostUntil.getDate() + BOOST_DAYS);
    return this.prisma.listing.update({
      where: { id: listingId },
      data: {
        boostUntil,
        boostScore: Math.min(boostScore + BOOST_SCORE_GAIN, BOOST_SCORE_MAX),
      },
    });
  }

  /**
   * Vérification active du boost — appelée depuis l'UI de paiement custom
   * (SOFTPAY) après paiement via Orange Money / Wave / Free Money, puisque
   * ces flux n'ont pas de "retour" navigateur déclenchant le webhook.
   */
  async verifyBoost(listingId: string, userId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
    });
    if (listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    const now = new Date();
    if (listing.boostUntil && listing.boostUntil > now) {
      return { boosted: true };
    }

    const bp = await this.prisma.boostPayment.findFirst({
      where: { listingId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!bp) return { boosted: false };

    const token = bp.paymentRef.replace('PD-', '');
    const confirm = await this.softpay.confirmInvoiceStatus(token);
    if (!confirm || confirm.status !== 'completed') {
      return { boosted: false };
    }

    await Promise.all([
      this.prisma.boostPayment.update({
        where: { id: bp.id },
        data: { status: 'CONFIRMED' },
      }),
      this.applyBoost(listingId, listing.boostScore),
    ]);
    return { boosted: true };
  }

  /**
   * Webhook IPN PayDunya pour le boost d'annonce. Comme pour les
   * réservations : le payload entrant n'est jamais une source de vérité —
   * `verifyAndParseCallback` vérifie le hash, puis on rappelle
   * `confirmInvoiceStatus` nous-mêmes auprès de PayDunya pour connaître le
   * statut réel.
   */
  async handleBoostWebhookPayDunya(rawBody: Record<string, unknown>) {
    const { token, customData } = this.softpay.verifyAndParseCallback(rawBody);

    const listingId = customData['listing_id'];
    if (typeof listingId !== 'string' || !listingId) return { ok: true };

    const bp = await this.prisma.boostPayment.findFirst({
      where: { listingId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!bp) return { ok: true }; // déjà traité (idempotence) ou inconnu

    const confirm = await this.softpay.confirmInvoiceStatus(token);
    if (!confirm) {
      throw new BadRequestException('Impossible de confirmer le paiement PayDunya');
    }

    if (confirm.status === 'completed') {
      const listing = await this.prisma.listing.findUniqueOrThrow({
        where: { id: listingId },
      });
      await Promise.all([
        this.prisma.boostPayment.update({
          where: { id: bp.id },
          data: { status: 'CONFIRMED', paymentRef: 'PD-' + token },
        }),
        this.applyBoost(listingId, listing.boostScore),
      ]);
    } else if (confirm.status === 'cancelled' || confirm.status === 'failed') {
      await this.prisma.boostPayment.update({
        where: { id: bp.id },
        data: { status: 'FAILED' },
      });
    }
    // status === 'pending' — on attend le prochain callback ou la vérification active.

    return { ok: true };
  }

  async findAll_admin(page = 1, limit = 20, status?: ListingStatus, city?: string) {
    const where = {
      ...(status && { status }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findMine(ownerId: string) {
    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { bookings: true, reviews: true } } },
      }),
      this.prisma.listing.count({ where: { ownerId } }),
    ]);
    return { data, total, page: 1, limit: total };
  }

  async addFavorite(listingId: string, userId: string) {
    await this.findOne(listingId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { favorites: { connect: { id: listingId } } },
      select: { id: true },
    });
  }

  async removeFavorite(listingId: string, userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { favorites: { disconnect: { id: listingId } } },
      select: { id: true },
    });
  }

  async findFavorites(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        favorites: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return user.favorites;
  }

  async isFavorite(listingId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id: userId, favorites: { some: { id: listingId } } },
    });
    return count > 0;
  }

  async reportListing(listingId: string, reporterId: string, dto: CreateReportDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId === reporterId) {
      throw new BadRequestException('You cannot report your own listing');
    }

    // Upsert — un seul signalement par utilisateur par annonce
    const report = await this.prisma.report.upsert({
      where: { listingId_reporterId: { listingId, reporterId } },
      create: { listingId, reporterId, reason: dto.reason, description: dto.description },
      update: { reason: dto.reason, description: dto.description },
    });

    // Notifier les admins (non bloquant)
    try {
      const reporter = await this.prisma.user.findUnique({
        where: { id: reporterId },
        select: { firstName: true, lastName: true, email: true },
      });
      const reportCount = await this.prisma.report.count({ where: { listingId } });
      const reporterName = [reporter?.firstName, reporter?.lastName].filter(Boolean).join(' ')
        || reporter?.email
        || 'Utilisateur';
      void this.notifications.notifyAdminReport(
        listingId,
        listing.title,
        reporterName,
        dto.reason,
        reportCount,
      );
    } catch { /* non bloquant */ }

    return report;
  }

  async findAllReports() {
    const listings = await this.prisma.listing.findMany({
      where: { reports: { some: {} } },
      include: {
        reports: {
          include: {
            reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { reports: { _count: 'desc' } },
    });

    return listings.map((l) => ({
      listingId: l.id,
      title:     l.title,
      city:      l.city,
      status:    l.status,
      ownerName: [l.owner.firstName, l.owner.lastName].filter(Boolean).join(' ') || l.owner.email,
      reportCount: l.reports.length,
      reasons:     [...new Set(l.reports.map((r) => r.reason))],
      lastReportAt: l.reports[0]?.createdAt ?? null,
      reports: l.reports.map((r) => ({
        id:          r.id,
        reason:      r.reason,
        description: r.description,
        createdAt:   r.createdAt,
        reporter: {
          id:    r.reporter.id,
          name:  [r.reporter.firstName, r.reporter.lastName].filter(Boolean).join(' ') || r.reporter.email,
          email: r.reporter.email,
        },
      })),
    }));
  }
}
