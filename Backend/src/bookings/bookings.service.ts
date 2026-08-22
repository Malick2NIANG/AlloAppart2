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

const DAYS_PER_MONTH = 30;      // base du prorata pour les jours résiduels
const MONTHLY_THRESHOLD = 25;   // au-delà, on facture au mois plutôt qu'à la nuit

/**
 * Ajoute n mois en bornant au dernier jour du mois d'arrivée.
 *
 * `setMonth` seul déborde : 31 janvier + 1 mois donnerait le 3 mars. Ici on
 * obtient le 28 (ou 29) février, ce qui correspond à l'intuition d'un bail.
 */
function addMonthsClamped(date: Date, n: number): Date {
  const day = date.getDate();
  const r = new Date(date);
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDayOfTargetMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDayOfTargetMonth));
  return r;
}

/**
 * Découpe un séjour en mois calendaires complets + jours résiduels.
 *
 * Un mois calendaire vaut un loyer mensuel, quel que soit son nombre de jours :
 * le locataire paie donc exactement le prix affiché « /mois ». Les jours qui
 * dépassent sont facturés au prorata (loyer ÷ 30).
 *
 *   1er juil → 1er août  = 1 mois,  0 jour
 *   1er juil → 1er oct   = 3 mois,  0 jour
 *   1er juil → 16 août   = 1 mois, 15 jours
 */
export function splitCalendarMonths(
  start: Date,
  end: Date,
): { months: number; remainderDays: number } {
  let months = 0;
  let cursor = start;

  for (;;) {
    const next = addMonthsClamped(start, months + 1);
    if (next.getTime() > end.getTime()) break;
    months += 1;
    cursor = next;
  }

  const remainderDays = Math.max(
    0,
    Math.round((end.getTime() - cursor.getTime()) / 86_400_000),
  );
  return { months, remainderDays };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateBookingDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
      select: { price: true, pricePerNight: true, minimumNights: true, title: true, city: true, owner: true },
    });
    if (listing.owner.id === tenantId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas réserver votre propre annonce',
      );
    }
    const startDate = new Date(dto.startDate);
    const endDate   = dto.endDate ? new Date(dto.endDate) : null;
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

    // ── Nombre de jours de séjour ────────────────────────────────────────────
    const days = endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 1;

    // Vérification séjour minimum
    if (listing.minimumNights && days < listing.minimumNights) {
      throw new BadRequestException(
        `Cette annonce requiert un séjour minimum de ${listing.minimumNights} nuit(s).`,
      );
    }

    // ── Calcul du montant total ──────────────────────────────────────────────
    // Règle :
    //   < 25 jours → tarif nuit préféré (loyer mensuel ÷ 30 × jours en fallback)
    //   ≥ 25 jours → mois calendaires × loyer mensuel + jours résiduels au prorata
    //                (tarif nuit × jours en fallback si pas de loyer mensuel)
    //
    // Un mois calendaire = un loyer mensuel, quel que soit son nombre de jours.
    // Le montant facturé coïncide donc avec le prix affiché « /mois » sur
    // l'annonce — un séjour du 1er juillet au 1er août coûte un loyer, pas
    // 31/30 de loyer.
    const monthlyPrice = Number(listing.price);
    const nightlyPrice = Number(listing.pricePerNight ?? 0);
    const hasMonthly = monthlyPrice > 0;
    const hasNightly = nightlyPrice > 0;

    let totalAmount: number;
    if (days >= MONTHLY_THRESHOLD && hasMonthly && endDate) {
      const { months, remainderDays } = splitCalendarMonths(startDate, endDate);
      totalAmount = Math.round(
        months * monthlyPrice + remainderDays * (monthlyPrice / DAYS_PER_MONTH),
      );
    } else if (hasNightly) {
      totalAmount = Math.round(nightlyPrice * days);
    } else {
      totalAmount = Math.round((monthlyPrice / DAYS_PER_MONTH) * days);
    }
    // ────────────────────────────────────────────────────────────────────────
    const commissionRate = Number(process.env.COMMISSION_RATE ?? '0.10');
    const platformFee    = Math.round(totalAmount * commissionRate);
    const landlordAmount = totalAmount - platformFee;
    const booking = await this.prisma.booking.create({
      data: {
        listingId: dto.listingId,
        tenantId,
        startDate,
        endDate: endDate ?? undefined,
        totalAmount,
        platformFee,
        landlordAmount,
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
    if (!booking) throw new NotFoundException('Booking not found');
    const isOwner = booking.listing.ownerId === userId;
    const isTenant = booking.tenantId === userId;
    if (!isOwner && !isTenant)
      throw new ForbiddenException('Access denied');
    return booking;
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true, tenant: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const isOwner = booking.listing.ownerId === userId;
    const isTenant = booking.tenantId === userId;
    if (!isOwner && !isTenant)
      throw new ForbiddenException('Access denied');
    return booking;
  }

  async confirm(id: string, ownerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    if (booking.listing.ownerId !== ownerId)
      throw new ForbiddenException('Not authorized');
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
      throw new ForbiddenException('Not authorized');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "Impossible d'annuler, statut: " + booking.status,
      );
    }

    // ── Politique d'annulation pour les réservations confirmées ─────────────
    // Séjour déjà commencé → annulation impossible
    if (booking.status === BookingStatus.CONFIRMED) {
      const now              = new Date();
      const startDate        = new Date(booking.startDate);
      const hoursUntilStart  = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilStart < 0) {
        throw new BadRequestException(
          'Impossible d\'annuler : le séjour a déjà commencé.',
        );
      }
    }

    // Politique de remboursement :
    // >7 jours avant l'arrivée ET annulation par le LOCATAIRE → remboursement intégral (REFUNDED)
    // ≤7 jours avant l'arrivée ET annulation par le LOCATAIRE → pénalité, fonds libérés au bailleur (RELEASED)
    // Annulation par le bailleur (ou admin en son nom) → toujours REFUNDED, quel que soit le délai.
    //
    // Anti-fraude : la pénalité de "délai court" ne doit s'appliquer qu'à une
    // annulation initiée par le locataire. Sans cette distinction, un bailleur
    // pouvait confirmer une réservation puis l'annuler lui-même juste avant
    // l'arrivée pour empocher les fonds séquestrés du locataire sans jamais
    // fournir le logement.
    const isTenantCancelling = user.id === booking.tenantId;
    let newEscrowStatus = booking.escrowStatus;
    if (booking.escrowStatus === EscrowStatus.HELD) {
      const hoursUntilStart =
        (new Date(booking.startDate).getTime() - Date.now()) / (1000 * 60 * 60);
      newEscrowStatus =
        isTenantCancelling && hoursUntilStart <= 7 * 24
          ? EscrowStatus.RELEASED   // pénalité d'annulation tardive par le locataire
          : EscrowStatus.REFUNDED;  // remboursement intégral
    }
    // ────────────────────────────────────────────────────────────────────────

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status:       BookingStatus.CANCELLED,
        escrowStatus: newEscrowStatus,
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
      throw new ForbiddenException('Not authorized');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Impossible de terminer, statut: ' + booking.status,
      );
    }

    // Garde-fou anti-fraude : on ne libère l'escrow que si le séjour est
    // effectivement terminé. Sans cette vérification, un bailleur pouvait
    // confirmer puis "Terminer" une réservation instantanément et récupérer
    // les fonds séquestrés du locataire avant même le début du séjour — la
    // libération anticipée légitime (litige, etc.) reste possible mais
    // uniquement via POST /payments/release/:bookingId (ADMIN uniquement).
    const stayEnd = booking.endDate ?? booking.startDate;
    if (new Date() < new Date(stayEnd)) {
      throw new BadRequestException(
        'Impossible de terminer cette réservation avant la fin du séjour prévu.',
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
