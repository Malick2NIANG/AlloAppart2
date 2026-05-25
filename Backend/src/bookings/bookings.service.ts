import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { type User, BookingStatus, EscrowStatus, Role } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateBookingDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
      select: { price: true, title: true, city: true, owner: true },
    });

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    // Server-side month calculation — never trust client-supplied amounts
    const months = endDate
      ? Math.max(
          1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth()) +
            (endDate.getDate() > startDate.getDate() ? 1 : 0),
        )
      : 1;
    const totalAmount = Number(listing.price) * months;

    const booking = await this.prisma.booking.create({
      data: {
        listingId: dto.listingId,
        tenantId,
        startDate,
        endDate: endDate ?? undefined,
        totalAmount,
        status: BookingStatus.PENDING,
      },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    this.notifications
      .notifyBookingCreated({
        tenantEmail: booking.tenant.email,
        tenantName: `${booking.tenant.firstName} ${booking.tenant.lastName}`,
        landlordEmail: listing.owner.email,
        landlordName: `${listing.owner.firstName} ${listing.owner.lastName}`,
        listingTitle: listing.title,
        listingCity: listing.city,
        bookingId: booking.id,
        totalAmount,
      })
      .catch(() => {});

    return booking;
  }

  async findMine(tenantId: string) {
    return this.prisma.booking.findMany({
      where: { tenantId },
      include: {
        listing: true,
        tenant: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReceived(ownerId: string) {
    return this.prisma.booking.findMany({
      where: { listing: { ownerId } },
      include: {
        listing: true,
        tenant: { select: { id: true, firstName: true, lastName: true } },
      },
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

    if (!isOwner && !isTenant)
      throw new ForbiddenException('Accès non autorisé');

    return booking;
  }

  async confirm(id: string, ownerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    if (booking.listing.ownerId !== ownerId)
      throw new ForbiddenException('Non autorisé');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Impossible de confirmer une réservation en statut ${booking.status}`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED },
    });

    this.notifications
      .notifyBookingConfirmed({
        tenantEmail: booking.tenant.email,
        tenantName: `${booking.tenant.firstName} ${booking.tenant.lastName}`,
        landlordEmail: booking.listing.owner.email,
        landlordName: `${booking.listing.owner.firstName} ${booking.listing.owner.lastName}`,
        listingTitle: booking.listing.title,
        listingCity: booking.listing.city,
        bookingId: booking.id,
        totalAmount: Number(booking.totalAmount),
      })
      .catch(() => {});

    return updated;
  }

  async cancel(id: string, user: User) {
    const booking = await this.findOne(id, user.id);
    const isOwnerOrTenant =
      booking.tenantId === user.id || booking.listing.ownerId === user.id;

    if (!isOwnerOrTenant && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Non autorisé');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Impossible d'annuler une réservation en statut ${booking.status}`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        ...(booking.escrowStatus === EscrowStatus.HELD && {
          escrowStatus: EscrowStatus.REFUNDED,
        }),
      },
    });

    this.notifications
      .notifyBookingCancelled({
        tenantEmail: booking.tenant.email,
        tenantName: `${booking.tenant.firstName} ${booking.tenant.lastName}`,
        listingTitle: booking.listing.title,
        bookingId: booking.id,
      })
      .catch(() => {});

    return updated;
  }

  async complete(id: string, user: User) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: true },
    });

    const isOwner = booking.listing.ownerId === user.id;

    if (!isOwner && !user.roles.includes(Role.ADMIN))
      throw new ForbiddenException('Non autorisé');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Impossible de terminer une réservation en statut ${booking.status}`,
      );
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.COMPLETED,
        escrowStatus: EscrowStatus.RELEASED,
      },
    });
  }
}
