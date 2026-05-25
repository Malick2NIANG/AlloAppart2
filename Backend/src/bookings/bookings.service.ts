import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { type User, BookingStatus, EscrowStatus, Role } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBookingDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
      select: { price: true },
    });

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    // Server-side month calculation — never trust client-supplied amounts
    const months = endDate
      ? Math.max(
          1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12
            + (endDate.getMonth() - startDate.getMonth())
            + (endDate.getDate() > startDate.getDate() ? 1 : 0),
        )
      : 1;
    const totalAmount = Number(listing.price) * months;

    return this.prisma.booking.create({
      data: {
        listingId: dto.listingId,
        tenantId,
        startDate,
        endDate: endDate ?? undefined,
        totalAmount,
        status: BookingStatus.PENDING,
      },
      include: { listing: true, tenant: true },
    });
  }

  async findMine(tenantId: string) {
    return this.prisma.booking.findMany({
      where: { tenantId },
      include: { listing: true, tenant: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReceived(ownerId: string) {
    return this.prisma.booking.findMany({
      where: { listing: { ownerId } },
      include: { listing: true, tenant: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true, tenant: true },
    });

    if (!booking) throw new NotFoundException('Réservation introuvable');

    const isOwner = booking.listing.ownerId === userId;
    const isTenant = booking.tenantId === userId;

    if (!isOwner && !isTenant) throw new ForbiddenException('Accès non autorisé');

    return booking;
  }

  async confirm(id: string, ownerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: true },
    });

    if (booking.listing.ownerId !== ownerId) throw new ForbiddenException('Non autorisé');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Impossible de confirmer une réservation en statut ${booking.status}`);
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED },
    });
  }

  async cancel(id: string, user: User) {
    const booking = await this.findOne(id, user.id);
    const isOwnerOrTenant =
      booking.tenantId === user.id || booking.listing.ownerId === user.id;

    if (!isOwnerOrTenant && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Non autorisé');
    }
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException(`Impossible d'annuler une réservation en statut ${booking.status}`);
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        ...(booking.escrowStatus === EscrowStatus.HELD && { escrowStatus: EscrowStatus.REFUNDED }),
      },
    });
  }

  async complete(id: string, user: User) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: true },
    });

    const isOwner = booking.listing.ownerId === user.id;

    if (!isOwner && !user.roles.includes(Role.ADMIN)) throw new ForbiddenException('Non autorisé');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Impossible de terminer une réservation en statut ${booking.status}`);
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED, escrowStatus: EscrowStatus.RELEASED },
    });
  }
}
