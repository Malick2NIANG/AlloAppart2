import { ForbiddenException, Injectable } from '@nestjs/common';
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
}
