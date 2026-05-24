import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, ListingStatus, Role, User } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnerStats(ownerId: string) {
    const [
      totalListings,
      publishedListings,
      totalBookings,
      confirmedBookings,
      completedAmounts,
      ratingAgg,
    ] = await Promise.all([
      this.prisma.listing.count({ where: { ownerId } }),
      this.prisma.listing.count({ where: { ownerId, status: ListingStatus.ACTIVE } }),
      this.prisma.booking.count({ where: { listing: { ownerId } } }),
      this.prisma.booking.count({
        where: {
          listing: { ownerId },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      }),
      this.prisma.booking.findMany({
        where: { listing: { ownerId }, status: BookingStatus.COMPLETED },
        select: { totalAmount: true },
      }),
      this.prisma.review.aggregate({
        where: { listing: { ownerId } },
        _avg: { rating: true },
      }),
    ]);

    const totalRevenue = completedAmounts.reduce((sum, b) => sum + Number(b.totalAmount), 0);
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
      completedBookings,
      pendingVerifications,
      confirmedBookings,
      completedVerifications,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.booking.count(),
      this.prisma.booking.findMany({
        where: { status: BookingStatus.COMPLETED },
        select: { totalAmount: true },
      }),
      this.prisma.verification.count({
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      }),
      this.prisma.booking.count({
        where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
      }),
      this.prisma.verification.count({ where: { status: 'DONE' } }),
    ]);

    const totalRevenue = completedBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);

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
}
