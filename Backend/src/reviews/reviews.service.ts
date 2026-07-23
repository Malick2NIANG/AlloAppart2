import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { type User, BookingStatus, Role } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(authorId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: dto.bookingId },
    });

    if (booking.tenantId !== authorId) {
      throw new ForbiddenException('Seul le locataire peut laisser un avis');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('La réservation doit être terminée');
    }

    if (booking.listingId !== dto.listingId) {
      throw new BadRequestException(
        'La réservation ne correspond pas à cette annonce',
      );
    }

    const existing = await this.prisma.review.findFirst({
      where: { bookingId: dto.bookingId },
    });
    if (existing)
      throw new ConflictException('Un avis existe déjà pour cette réservation');

    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        authorId,
        listingId: dto.listingId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        author:  { select: { firstName: true, lastName: true } },
        listing: { select: { title: true, ownerId: true } },
      },
    });

    // Notifier le bailleur en temps réel
    void this.notifications.notifyReviewReceived(
      review.listing.ownerId,
      `${review.author.firstName} ${review.author.lastName}`,
      review.listing.title,
      review.rating,
      review.listingId,
    );

    return review;
  }

  async findByListing(listingId: string, page = 1, limit = 20) {
    return this.prisma.review.findMany({
      where: { listingId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findAll(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          listing: { select: { id: true, title: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count(),
    ]);
    return { data, total, page, limit };
  }

  /** Tous les avis rédigés par ce locataire (pour savoir quels bookings sont déjà notés) */
  async findMine(authorId: string) {
    return this.prisma.review.findMany({
      where: { authorId },
      select: { id: true, bookingId: true, listingId: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Tous les avis reçus sur les annonces de ce bailleur */
  async findByOwner(ownerId: string) {
    const [data, agg] = await Promise.all([
      this.prisma.review.findMany({
        where: { listing: { ownerId } },
        include: {
          author:  { select: { id: true, firstName: true, lastName: true, avatar: true } },
          listing: { select: { id: true, title: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { listing: { ownerId } },
        _avg:   { rating: true },
        _count: { id: true },
      }),
    ]);
    return {
      data,
      avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      total: agg._count.id,
    };
  }

  async remove(id: string, admin: User) {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }
    return this.prisma.review.delete({ where: { id } });
  }
}
