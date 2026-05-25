import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { ListingStatus, Role, User } from '@prisma/client';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
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
        amenities.length > 0 && {
          amenities: { hasEvery: amenities },
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
    const listing = await this.prisma.listing.create({
      data: { ...dto, ownerId },
    });
    void this.search.indexListing(listing).catch(() => undefined);
    return listing;
  }

  async update(id: string, user: User, dto: UpdateListingDto) {
    const listing = await this.findOne(id);

    if (listing.ownerId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Non autorisé');
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: dto,
    });
    void this.search.indexListing(updated).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user: User) {
    const listing = await this.findOne(id);

    if (listing.ownerId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Non autorisé');
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
      throw new ForbiddenException('Non autorisé');

    const BOOST_MAX = 100;
    const boostUntil = new Date();
    boostUntil.setDate(boostUntil.getDate() + 30);

    return this.prisma.listing.update({
      where: { id },
      data: {
        boostUntil,
        boostScore: Math.min(listing.boostScore + 10, BOOST_MAX),
      },
    });
  }

  async findAll_admin(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count(),
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
    await this.findOne(listingId); // 404 if not found
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
