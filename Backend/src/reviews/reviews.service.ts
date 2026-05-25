import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { type User, BookingStatus, Role } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        authorId,
        listingId: dto.listingId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
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

  async remove(id: string, admin: User) {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }
    return this.prisma.review.delete({ where: { id } });
  }
}
