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
    const farFuture = new Date('9999-12-31');
    const overlap = await this.prisma.booking.findFirst({
      where: {
        listingId: dto.listingId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startDate: { lte: endDate ?? farFuture },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        'Ces dates sont deja reservees pour ce logement',
      );
    }
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
        tenantName: booking.tenant.firstName + ' ' + booking.tenant.lastName,
        tenantId: booking.tenantId,
        landlordEmail: listing.owner.email,
        landlordName: listing.owner.firstName + ' ' + listing.owner.lastName,
        listingTitle: listing.title,
        listingCity: listing.city,
        bookingId: booking.id,
        totalAmount,
      })
      .catch(() => {});
    return booking;
  }

  async getAvailability(listingId: string) {
    return this.prisma.booking.findMany({
      where: {
        listingId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      select: { startDate: true, endDate: true, status: true },
      orderBy: { startDate: 'asc' },
    });
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

  async findReceived(ownerId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { listing: { ownerId } },
        include: {
          listing: true,
          tenant: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where: { listing: { ownerId } } }),
    ]);
    return { data, total, page, limit };
  }

  async findOneForReceipt(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true, tenant: true },
    });
    if (!booking) throw new NotFoundException('Reservation introuvable');
    const isOwner = booking.listing.ownerId === userId;
    const isTenant = booking.tenantId === userId;
    if (!isOwner && !isTenant)
      throw new ForbiddenException('Acces non autorise');
    return booking;
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true, tenant: true },
    });
    if (!booking) throw new NotFoundException('Reservation introuvable');
    const isOwner = booking.listing.ownerId === userId;
    const isTenant = booking.tenantId === userId;
    if (!isOwner && !isTenant)
      throw new ForbiddenException('Acces non autorise');
    return booking;
  }

  async confirm(id: string, ownerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    if (booking.listing.ownerId !== ownerId)
      throw new ForbiddenException('Non autorise');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        'Impossible de confirmer, statut: ' + booking.status,
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED },
    });
    this.notifications
      .notifyBookingConfirmed({
        tenantEmail: booking.tenant.email,
        tenantName: booking.tenant.firstName + ' ' + booking.tenant.lastName,
        tenantId: booking.tenantId,
        landlordEmail: booking.listing.owner.email,
        landlordName:
          booking.listing.owner.firstName +
          ' ' +
          booking.listing.owner.lastName,
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
      throw new ForbiddenException('Non autorise');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "Impossible d'annuler, statut: " + booking.status,
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
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    this.notifications
      .notifyBookingCancelled({
        tenantEmail: updated.tenant.email,
        tenantName: updated.tenant.firstName + ' ' + updated.tenant.lastName,
        tenantId: updated.tenantId,
        landlordEmail: updated.listing.owner.email,
        landlordName:
          updated.listing.owner.firstName +
          ' ' +
          updated.listing.owner.lastName,
        listingTitle: updated.listing.title,
        listingCity: updated.listing.city,
        bookingId: updated.id,
        totalAmount: Number(updated.totalAmount),
      })
      .catch(() => {});
    return updated;
  }

  async findAll(page = 1, limit = 20, status?: BookingStatus) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          listing: { select: { id: true, title: true, city: true } },
          tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async complete(id: string, user: User) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: true },
    });
    const isOwner = booking.listing.ownerId === user.id;
    if (!isOwner && !user.roles.includes(Role.ADMIN))
      throw new ForbiddenException('Non autorise');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Impossible de terminer, statut: ' + booking.status,
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
