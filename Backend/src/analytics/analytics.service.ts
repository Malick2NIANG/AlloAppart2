import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BookingStatus,
  ListingStatus,
  Role,
  SubscriptionStatus,
  User,
  VerifStatus,
} from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLocataireStats(userId: string) {
    const [totalBookings, activeBookings, favoritesResult, unreadMessages] = await Promise.all([
      this.prisma.booking.count({ where: { tenantId: userId } }),
      this.prisma.booking.count({
        where: {
          tenantId: userId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      }),
      // Favoris : relation many-to-many User <-> Listing via "UserFavorites"
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { _count: { select: { favorites: true } } },
      }),
      // Messages non lus : messages dans les rooms du locataire, envoyés par quelqu'un d'autre, sans readAt
      this.prisma.message.count({
        where: {
          room: { participants: { some: { id: userId } } },
          senderId: { not: userId },
          readAt: null,
        },
      }),
    ]);

    return {
      totalBookings,
      activeBookings,
      favorites: favoritesResult?._count.favorites ?? 0,
      unreadMessages,
    };
  }

  async getOwnerStats(ownerId: string) {
    const [
      totalListings,
      publishedListings,
      totalBookings,
      confirmedBookings,
      revenueAgg,
      ratingAgg,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { ownerId } }),
      this.prisma.listing.count({
        where: { ownerId, status: ListingStatus.ACTIVE },
      }),
      this.prisma.booking.count({ where: { listing: { ownerId } } }),
      this.prisma.booking.count({
        where: {
          listing: { ownerId },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      }),
      this.prisma.booking.aggregate({
        where: { listing: { ownerId }, status: BookingStatus.COMPLETED },
        _sum: { totalAmount: true },
      }),
      this.prisma.review.aggregate({
        where: { listing: { ownerId } },
        _avg: { rating: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
    const avgRating = ratingAgg._avg.rating;

    return {
      totalListings,
      publishedListings,
      totalBookings,
      confirmedBookings,
      totalRevenue,
      avgRating,
    };
  }

  async getAdminStats(admin: User) {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const [
      totalUsers,
      totalListings,
      publishedListings,
      totalBookings,
      revenueAgg,
      pendingVerifications,
      confirmedBookings,
      completedVerifications,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.booking.count(),
      this.prisma.booking.aggregate({
        where: { status: BookingStatus.COMPLETED },
        _sum: { totalAmount: true },
      }),
      this.prisma.verification.count({
        where: {
          status: { in: [VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      }),
      this.prisma.verification.count({ where: { status: VerifStatus.DONE } }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);

    return {
      totalUsers,
      totalListings,
      publishedListings,
      totalBookings,
      confirmedBookings,
      totalRevenue,
      pendingVerifications,
      completedVerifications,
    };
  }

  async getAdminExtended(admin: User) {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLocataires,
      totalBailleurs,
      totalProAgences,
      totalAgents,
      newUsersLast30,
      newListingsLast30,
      newBookingsLast30,
      revenueLast30Agg,
      listingsDraft,
      listingsActive,
      listingsRented,
      listingsSuspended,
      bookingsPending,
      bookingsConfirmed,
      bookingsCancelled,
      bookingsCompleted,
    ] = await Promise.all([
      this.prisma.user.count({ where: { roles: { has: Role.LOCATAIRE } } }),
      this.prisma.user.count({ where: { roles: { has: Role.BAILLEUR } } }),
      this.prisma.user.count({ where: { roles: { has: Role.PRO_AGENCE } } }),
      this.prisma.user.count({ where: { roles: { has: Role.AGENT_TERRAIN } } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.listing.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.booking.aggregate({
        where: { status: BookingStatus.COMPLETED, createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
      }),
      this.prisma.listing.count({ where: { status: ListingStatus.DRAFT } }),
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.listing.count({ where: { status: ListingStatus.RENTED } }),
      this.prisma.listing.count({ where: { status: ListingStatus.SUSPENDED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
    ]);

    return {
      roleBreakdown: { totalLocataires, totalBailleurs, totalProAgences, totalAgents },
      last30Days: {
        newUsers: newUsersLast30,
        newListings: newListingsLast30,
        newBookings: newBookingsLast30,
        revenue: Number(revenueLast30Agg._sum.totalAmount ?? 0),
      },
      listingsByStatus: {
        DRAFT: listingsDraft,
        ACTIVE: listingsActive,
        RENTED: listingsRented,
        SUSPENDED: listingsSuspended,
      },
      bookingsByStatus: {
        PENDING: bookingsPending,
        CONFIRMED: bookingsConfirmed,
        CANCELLED: bookingsCancelled,
        COMPLETED: bookingsCompleted,
      },
    };
  }

  async getAdminAlerts(admin: User) {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [overdueVerifications, expiringSubscriptions, suspendedListings] =
      await Promise.all([
        this.prisma.verification.count({
          where: {
            status: {
              in: [VerifStatus.REQUESTED, VerifStatus.SCHEDULED, VerifStatus.IN_PROGRESS],
            },
            createdAt: { lt: twentyFourHoursAgo },
          },
        }),
        this.prisma.subscription.count({
          where: {
            status: SubscriptionStatus.ACTIVE,
            endDate: { lte: sevenDaysFromNow, gte: new Date() },
          },
        }),
        this.prisma.listing.count({ where: { status: ListingStatus.SUSPENDED } }),
      ]);

    return { overdueVerifications, expiringSubscriptions, suspendedListings };
  }

  async getOwnerMonthlyStats(ownerId: string) {
    // 6 derniers mois (mois courant inclus)
    const months: { year: number; month: number; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      });
    }

    const results = await Promise.all(
      months.map(async ({ year, month, label }) => {
        const start = new Date(year, month - 1, 1);
        const end   = new Date(year, month, 1);

        const [bookings, revenue] = await Promise.all([
          this.prisma.booking.count({
            where: {
              listing: { ownerId },
              createdAt: { gte: start, lt: end },
            },
          }),
          this.prisma.booking.aggregate({
            where: {
              listing: { ownerId },
              status: BookingStatus.COMPLETED,
              createdAt: { gte: start, lt: end },
            },
            _sum: { totalAmount: true },
          }),
        ]);

        return {
          label,
          bookings,
          revenue: Number(revenue._sum.totalAmount ?? 0),
        };
      }),
    );

    return results;
  }

  async getOwnerMonthlyReport(ownerId: string, monthStr: string) {
    // monthStr format: "YYYY-MM"
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year  = parseInt(yearStr ?? '', 10);
    const month = parseInt(monthNumStr ?? '', 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('Format de mois invalide. Utilisez YYYY-MM.');
    }

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { firstName: true, lastName: true, agencyName: true },
    });

    const [stats, bookings] = await Promise.all([
      this.getOwnerStats(ownerId),
      this.prisma.booking.findMany({
        where: {
          listing: { ownerId },
          createdAt: { gte: start, lt: end },
        },
        include: {
          listing: { select: { title: true } },
          tenant:  { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ownerName: owner.agencyName ?? `${owner.firstName} ${owner.lastName}`,
      month: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      stats,
      bookings: bookings.map((b) => ({
        id: b.id,
        listingTitle: b.listing.title,
        tenantName:   `${b.tenant.firstName} ${b.tenant.lastName}`,
        startDate:    b.startDate,
        totalAmount:  b.totalAmount,
        status:       b.status,
      })),
    };
  }

  /** Analytics vitrine PRO_AGENCE */
  async getVitrineStats(ownerId: string) {
    const [owner, listings, ratingAgg, monthly] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: ownerId },
        select: { profileViews: true, agencyName: true, agencySlug: true, subscription: { select: { plan: true, status: true } } },
      }),
      this.prisma.listing.findMany({
        where: { ownerId },
        select: {
          id: true, title: true, city: true, type: true, status: true,
          _count: { select: { bookings: true, reviews: true, favoritedBy: true } },
          bookings: {
            where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
            select: { totalAmount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { listing: { ownerId } },
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.getOwnerMonthlyStats(ownerId),
    ]);

    // Enrichissement par listing : revenu confirmé + bookings confirmés
    const listingStats = listings.map((l) => ({
      id:             l.id,
      title:          l.title,
      city:           l.city,
      type:           l.type,
      status:         l.status,
      totalBookings:  l._count.bookings,
      favorites:      l._count.favoritedBy,
      reviewCount:    l._count.reviews,
      revenue:        l.bookings.reduce((s, b) => s + Number(b.totalAmount), 0),
    }));

    // Top 5 par réservations
    const topListings = [...listingStats]
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 5);

    return {
      profileViews:  owner.profileViews,
      agencyName:    owner.agencyName,
      agencySlug:    owner.agencySlug,
      subscription:  owner.subscription,
      totalListings: listings.length,
      activeListings: listings.filter((l) => l.status === 'ACTIVE').length,
      avgRating:     ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
      reviewCount:   ratingAgg._count.id,
      totalRevenue:  listingStats.reduce((s, l) => s + l.revenue, 0),
      topListings,
      monthly,
    };
  }
}
