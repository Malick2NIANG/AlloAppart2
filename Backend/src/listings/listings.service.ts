import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '../search/search.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { ListingStatus, Role, SubscriptionPlan, SubscriptionStatus, User } from '@prisma/client';
import axios from 'axios';
import { PaydunyaWebhookDto } from '../payments/dto/paydunya-webhook.dto';

const BOOST_PRICE_XOF = 5_000;
const BOOST_DAYS = 7;
const BOOST_SCORE_GAIN = 10;
const BOOST_SCORE_MAX = 100;
const STARTER_MAX_LISTINGS = 10;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly config: ConfigService,
  ) {}

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
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
          { region: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { reviews: true } },
          reviews: { select: { rating: true } },
        },
        orderBy: [{ boostScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    const enriched = data.map((listing) => {
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
        owner: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { reviews: true } },
        reviews: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        verification: {
          select: {
            status: true,
            auditType: true,
            scheduledAt: true,
            completedAt: true,
            notes: true,
            reportUrl: true,
          },
        },
      },
    });
    if (!listing) throw new NotFoundException('Annonce introuvable');
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

  async create(ownerId: string, dto: CreateListingDto) {
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      include: { subscription: true },
    });

    if (owner.roles.includes(Role.PRO_AGENCE)) {
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

    const listing = await this.prisma.listing.create({
      data: { ...dto, ownerId },
    });
    void this.search.indexListing(listing).catch(() => undefined);
    return listing;
  }

  async update(id: string, user: User, dto: UpdateListingDto) {
    const listing = await this.findOne(id);
    if (listing.ownerId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Non autorise');
    }
    const updated = await this.prisma.listing.update({
      where: { id },
      data: dto,
    });
    void this.search.indexListing(updated).catch(() => undefined);
    return updated;
  }

  async unpublishListing(id: string, userId: string) {
    const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id } });
    if (listing.ownerId !== userId) {
      throw new ForbiddenException('Non autorise');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Seules les annonces actives peuvent être dépubliées');
    }
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.DRAFT },
    });
    void this.search.indexListing(updated).catch(() => undefined);
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
    void this.search.indexListing(updated).catch(() => undefined);
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
      throw new ForbiddenException('Non autorise');
    }
    const removed = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.SUSPENDED },
    });
    void this.search.deleteListingFromIndex(id).catch(() => undefined);
    return removed;
  }

  async boost(id: string, user: User) {
    const listing = await this.findOne(id);
    if (listing.ownerId !== user.id)
      throw new ForbiddenException('Non autorise');
    return this.initiateBoostWithPayDunya(id);
  }

  private async initiateBoostWithPayDunya(listingId: string) {
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
        baseUrl + '/checkout-invoice/create',
        {
          invoice: {
            total_amount: BOOST_PRICE_XOF,
            description: 'Boost annonce ' + BOOST_DAYS + 'j -- AlloAppart',
            return_url:
              this.config.get<string>('FRONTEND_URL') +
              '/bailleur/listings?boost=success',
            cancel_url:
              this.config.get<string>('FRONTEND_URL') +
              '/bailleur/listings?boost=cancel',
            callback_url:
              this.config.get<string>('BACKEND_URL') +
              '/api/v1/listings/webhook/boost/paydunya',
          },
          store: { name: 'AlloAppart' },
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
      .catch(() => {
        throw new BadRequestException('Service de paiement indisponible');
      });

    if (response.data.response_code !== '00') {
      throw new BadRequestException('Service de paiement indisponible');
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
    return { payment_url: response.data.invoice_url, transId: paymentRef };
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

  async handleBoostWebhookPayDunya(dto: PaydunyaWebhookDto) {
    const masterKey = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token = this.config.get<string>('PAYDUNYA_TOKEN');
    if (!masterKey || !privateKey || !token)
      throw new BadRequestException('PAYDUNYA_* manquant');
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';
    const confirm = await axios
      .get<{
        response_code: string;
        status: string;
        custom_data: { listing_id: string };
      }>(baseUrl + '/checkout-invoice/confirm/' + dto.data, {
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
    const listingId = custom_data?.listing_id;
    if (!listingId) return { ok: true };
    const bp = await this.prisma.boostPayment.findFirst({
      where: { listingId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!bp) return { ok: true };
    if (status === 'completed') {
      const listing = await this.prisma.listing.findUniqueOrThrow({
        where: { id: listingId },
      });
      await Promise.all([
        this.prisma.boostPayment.update({
          where: { id: bp.id },
          data: { status: 'CONFIRMED', paymentRef: 'PD-' + dto.data },
        }),
        this.applyBoost(listingId, listing.boostScore),
      ]);
    } else {
      await this.prisma.boostPayment.update({
        where: { id: bp.id },
        data: { status: 'FAILED' },
      });
    }
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
}
