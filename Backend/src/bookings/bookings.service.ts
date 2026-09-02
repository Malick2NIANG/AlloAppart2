import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateMonthlyBookingDto } from './dto/create-monthly-booking.dto';
import { ReportDisputeDto } from './dto/report-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import {
  type User,
  BookingStatus,
  BookingType,
  EscrowStatus,
  ListingStatus,
  RentalMode,
  Role,
} from '@prisma/client';

// Fenêtre de signalement de non-conformité — Article 9 des CGU
const DISPUTE_WINDOW_HOURS = 24;

const DAYS_PER_MONTH = 30; // base du prorata nuitée quand aucun tarif/nuit n'est défini
// Repli si une annonce MIXTE plus ancienne n'a pas (encore) de minLeaseMonths
// renseigné — ne devrait plus arriver, ce champ est requis en mode MIXTE.
const DEFAULT_MIN_LEASE_MONTHS = 1;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateBookingDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
      select: {
        price: true,
        pricePerNight: true,
        minimumNights: true,
        maximumNights: true,
        rentalMode: true,
        minLeaseMonths: true,
        title: true,
        city: true,
        owner: true,
        status: true,
      },
    });
    if (listing.owner.id === tenantId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas réserver votre propre annonce',
      );
    }
    // Un bien actuellement loué au mois (bail actif, mode hybride) n'est pas
    // disponible pour une réservation nuitée, quelles que soient les dates.
    if (listing.status === ListingStatus.RENTED) {
      throw new BadRequestException(
        "Ce logement est actuellement loué au mois et n'est pas disponible à la réservation.",
      );
    }
    // Une annonce exclusivement mensuelle ne propose pas de réservation
    // nuitée — passe par createMonthlyRequest() (demande + caution).
    if (listing.rentalMode === RentalMode.MONTHLY) {
      throw new BadRequestException(
        "Cette annonce n'est disponible qu'en location au mois. Faites une demande de location au mois.",
      );
    }
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

    // ── Nombre de jours de séjour ────────────────────────────────────────────
    const days = endDate
      ? Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 1;

    // Vérification séjour minimum
    if (listing.minimumNights && days < listing.minimumNights) {
      throw new BadRequestException(
        `Cette annonce requiert un séjour minimum de ${listing.minimumNights} nuit(s).`,
      );
    }

    // Séjour maximum (optionnel, mode NIGHTLY uniquement — le mode MIXTE a
    // déjà son propre seuil via minLeaseMonths ci-dessous).
    if (
      listing.rentalMode === RentalMode.NIGHTLY &&
      listing.maximumNights &&
      days > listing.maximumNights
    ) {
      throw new BadRequestException(
        `Cette annonce accepte un séjour maximum de ${listing.maximumNights} nuit(s).`,
      );
    }

    // Annonce MIXTE + séjour atteignant la durée minimale du bail : on ne
    // facture plus au tarif nuitée en le basculant automatiquement au tarif
    // mensuel — on redirige vers le vrai produit "location au mois" (caution
    // + validation). Le seuil est la durée minimale de bail fixée par le
    // bailleur (minLeaseMonths), convertie en jours — pas une valeur fixe.
    if (listing.rentalMode === RentalMode.MIXED) {
      const minLeaseDays =
        (listing.minLeaseMonths ?? DEFAULT_MIN_LEASE_MONTHS) * DAYS_PER_MONTH;
      if (days >= minLeaseDays) {
        throw new BadRequestException(
          `Cette annonce passe en location au mois à partir de ${listing.minLeaseMonths ?? DEFAULT_MIN_LEASE_MONTHS} mois de séjour — faites une demande de location au mois (caution + validation du bailleur) plutôt qu'une réservation nuitée.`,
        );
      }
    }

    // ── Calcul du montant total ──────────────────────────────────────────────
    // Tarif/nuit × nombre de nuits — pas de bascule vers le tarif mensuel ici,
    // voir createMonthlyRequest() pour la location au mois.
    const monthlyPrice = Number(listing.price);
    const nightlyPrice = Number(listing.pricePerNight ?? 0);
    const hasNightly = nightlyPrice > 0;

    const totalAmount = hasNightly
      ? Math.round(nightlyPrice * days)
      : Math.round((monthlyPrice / DAYS_PER_MONTH) * days);
    // ────────────────────────────────────────────────────────────────────────
    const commissionRate = Number(process.env.COMMISSION_RATE ?? '0.10');
    const platformFee = Math.round(totalAmount * commissionRate);
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

  /**
   * Demande de location au mois (système hybride) — statut REQUESTED,
   * pas de date de fin (bail ouvert), caution + 1er mois calculés à la
   * réservation. Nécessite l'approbation du bailleur avant paiement.
   */
  async createMonthlyRequest(tenantId: string, dto: CreateMonthlyBookingDto) {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
      select: {
        price: true,
        depositMonths: true,
        title: true,
        city: true,
        owner: true,
        status: true,
        rentalMode: true,
      },
    });

    if (listing.owner.id === tenantId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas réserver votre propre annonce',
      );
    }
    if (
      listing.rentalMode !== RentalMode.MONTHLY &&
      listing.rentalMode !== RentalMode.MIXED
    ) {
      throw new BadRequestException(
        "Cette annonce n'accepte pas la location au mois.",
      );
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(
        "Ce logement n'est pas disponible actuellement.",
      );
    }

    // Une seule demande/bail mensuel à la fois par annonce.
    const existingMonthly = await this.prisma.booking.findFirst({
      where: {
        listingId: dto.listingId,
        bookingType: BookingType.MONTHLY,
        status: {
          in: [
            BookingStatus.REQUESTED,
            BookingStatus.APPROVED,
            BookingStatus.ACTIVE,
          ],
        },
      },
    });
    if (existingMonthly) {
      throw new BadRequestException(
        'Une demande de location au mois est déjà en cours pour ce logement.',
      );
    }

    // La date d'entrée souhaitée ne doit pas tomber dans une nuitée déjà réservée.
    const moveInDate = new Date(dto.moveInDate);
    const nightlyOverlap = await this.prisma.booking.findFirst({
      where: {
        listingId: dto.listingId,
        bookingType: BookingType.NIGHTLY,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startDate: { lte: moveInDate },
        endDate: { gte: moveInDate },
      },
    });
    if (nightlyOverlap) {
      throw new BadRequestException(
        "Cette date d'entrée chevauche un séjour nuitée déjà réservé.",
      );
    }

    const monthlyPrice = Number(listing.price);
    const depositAmount = Math.round(
      monthlyPrice * (listing.depositMonths ?? 0),
    );
    const totalAmount = Math.round(monthlyPrice + depositAmount);
    // Commission courtier (location au mois) : pratique standard au Sénégal —
    // sur la caution encaissée, AlloAppart prélève l'équivalent d'1 mois de
    // loyer ; le bailleur perçoit le 1er loyer + le reste de la caution.
    // (Différent du taux COMMISSION_RATE appliqué aux réservations nuitée.)
    const platformFee = Math.round(monthlyPrice);
    const landlordAmount = Math.max(0, totalAmount - platformFee);

    const booking = await this.prisma.booking.create({
      data: {
        listingId: dto.listingId,
        tenantId,
        bookingType: BookingType.MONTHLY,
        status: BookingStatus.REQUESTED,
        startDate: moveInDate,
        totalAmount,
        platformFee,
        landlordAmount,
        depositAmount,
        ...(dto.documents?.length
          ? {
              documents: {
                create: dto.documents.map((d) => ({
                  type: d.type,
                  fileUrl: d.fileUrl,
                })),
              },
            }
          : {}),
      },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    this.notifications
      .notifyMonthlyRequestCreated({
        tenantEmail: booking.tenant.email,
        tenantName: booking.tenant.firstName + ' ' + booking.tenant.lastName,
        tenantId: booking.tenantId,
        landlordEmail: listing.owner.email,
        landlordName: listing.owner.firstName + ' ' + listing.owner.lastName,
        landlordId: listing.owner.id,
        listingTitle: listing.title,
        listingCity: listing.city,
        bookingId: booking.id,
        totalAmount,
      })
      .catch(() => {});

    return booking;
  }

  /** Le bailleur/agence approuve une demande de location au mois. */
  async approveMonthlyRequest(id: string, ownerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }
    if (
      booking.bookingType !== BookingType.MONTHLY ||
      booking.status !== BookingStatus.REQUESTED
    ) {
      throw new BadRequestException(
        "Impossible d'approuver, statut: " + booking.status,
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.APPROVED },
    });
    this.notifications
      .notifyMonthlyRequestApproved({
        tenantEmail: booking.tenant.email,
        tenantName: booking.tenant.firstName + ' ' + booking.tenant.lastName,
        tenantId: booking.tenantId,
        landlordEmail: booking.listing.owner.email,
        landlordName:
          booking.listing.owner.firstName +
          ' ' +
          booking.listing.owner.lastName,
        landlordId: booking.listing.ownerId,
        listingTitle: booking.listing.title,
        listingCity: booking.listing.city,
        bookingId: booking.id,
        totalAmount: Number(booking.totalAmount),
      })
      .catch(() => {});
    return updated;
  }

  /** Le bailleur/agence refuse une demande de location au mois. */
  async rejectMonthlyRequest(id: string, ownerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }
    if (
      booking.bookingType !== BookingType.MONTHLY ||
      booking.status !== BookingStatus.REQUESTED
    ) {
      throw new BadRequestException(
        'Impossible de refuser, statut: ' + booking.status,
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.REJECTED },
    });
    this.notifications
      .notifyMonthlyRequestRejected({
        tenantEmail: booking.tenant.email,
        tenantName: booking.tenant.firstName + ' ' + booking.tenant.lastName,
        tenantId: booking.tenantId,
        landlordEmail: booking.listing.owner.email,
        landlordName:
          booking.listing.owner.firstName +
          ' ' +
          booking.listing.owner.lastName,
        landlordId: booking.listing.ownerId,
        listingTitle: booking.listing.title,
        listingCity: booking.listing.city,
        bookingId: booking.id,
        totalAmount: Number(booking.totalAmount),
      })
      .catch(() => {});
    return updated;
  }

  /**
   * Résilie un bail mensuel actif (à l'initiative du bailleur ou du
   * locataire) — repasse l'annonce en ACTIVE, à nouveau bookable.
   */
  async terminateLease(id: string, user: User) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    const isOwner = booking.listing.ownerId === user.id;
    const isTenant = booking.tenantId === user.id;
    if (!isOwner && !isTenant && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Not authorized');
    }
    if (
      booking.bookingType !== BookingType.MONTHLY ||
      booking.status !== BookingStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Impossible de résilier, statut: ' + booking.status,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.TERMINATED, terminatedAt: new Date() },
      }),
      this.prisma.listing.update({
        where: { id: booking.listingId },
        data: { status: ListingStatus.ACTIVE },
      }),
    ]);

    this.notifications
      .notifyLeaseTerminated({
        tenantEmail: booking.tenant.email,
        tenantName: booking.tenant.firstName + ' ' + booking.tenant.lastName,
        tenantId: booking.tenantId,
        landlordEmail: booking.listing.owner.email,
        landlordName:
          booking.listing.owner.firstName +
          ' ' +
          booking.listing.owner.lastName,
        landlordId: booking.listing.ownerId,
        listingTitle: booking.listing.title,
        listingCity: booking.listing.city,
        bookingId: booking.id,
        totalAmount: Number(booking.totalAmount),
        terminatedByTenant: isTenant,
      })
      .catch(() => {});

    return updated;
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
        documents: true,
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
          documents: true,
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
    if (!isOwner && !isTenant) throw new ForbiddenException('Access denied');
    return booking;
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true, tenant: true, documents: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const isOwner = booking.listing.ownerId === userId;
    const isTenant = booking.tenantId === userId;
    if (!isOwner && !isTenant) throw new ForbiddenException('Access denied');
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
      const now = new Date();
      const startDate = new Date(booking.startDate);
      const hoursUntilStart =
        (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilStart < 0) {
        throw new BadRequestException(
          "Impossible d'annuler : le séjour a déjà commencé.",
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
          ? EscrowStatus.RELEASED // pénalité d'annulation tardive par le locataire
          : EscrowStatus.REFUNDED; // remboursement intégral
    }
    // ────────────────────────────────────────────────────────────────────────

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
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
          tenant: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
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
    if (booking.escrowStatus === EscrowStatus.DISPUTED) {
      throw new BadRequestException(
        'Cette réservation fait l\'objet d\'un litige en cours — utilisez la résolution de litige plutôt que "Terminer".',
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

  /**
   * Signalement de non-conformité par le locataire — Article 9 des CGU.
   * Fenêtre de 24h à compter du début du séjour (`startDate`), seule donnée
   * d'"entrée dans les lieux" disponible dans le modèle actuel. Gèle
   * l'escrow (passage à DISPUTED) le temps de l'examen du litige.
   */
  async reportDispute(id: string, tenantId: string, dto: ReportDisputeDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    if (booking.tenantId !== tenantId) {
      throw new ForbiddenException('Not authorized');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        "Seule une réservation confirmée peut faire l'objet d'un signalement.",
      );
    }
    if (booking.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        "Cette réservation ne peut plus faire l'objet d'un signalement (statut : " +
          booking.escrowStatus +
          ').',
      );
    }

    const hoursSinceStart =
      (Date.now() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60);
    if (hoursSinceStart < 0) {
      throw new BadRequestException("Le séjour n'a pas encore commencé.");
    }
    if (hoursSinceStart > DISPUTE_WINDOW_HOURS) {
      throw new BadRequestException(
        `Le délai de ${DISPUTE_WINDOW_HOURS} heures pour signaler une non-conformité est dépassé.`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        escrowStatus: EscrowStatus.DISPUTED,
        disputeReason: dto.reason,
        disputeEvidence: dto.evidence,
        disputedAt: new Date(),
      },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    void this.notifications
      .notifyDisputeReported(
        updated.listing.ownerId,
        updated.listing.title,
        updated.id,
        updated.listingId,
      )
      .catch(() => {});

    return updated;
  }

  /**
   * Résolution d'un litige par un ADMIN — décide de la libération ou du
   * remboursement des fonds séquestrés (Article 9 des CGU).
   */
  async resolveDispute(id: string, admin: User, dto: ResolveDisputeDto) {
    if (!admin.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin only');
    }
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { listing: { include: { owner: true } }, tenant: true },
    });
    if (booking.escrowStatus !== EscrowStatus.DISPUTED) {
      throw new BadRequestException("Cette réservation n'est pas en litige.");
    }

    const releasing = dto.decision === 'RELEASE';
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: releasing ? BookingStatus.COMPLETED : BookingStatus.CANCELLED,
        escrowStatus: releasing ? EscrowStatus.RELEASED : EscrowStatus.REFUNDED,
        disputeResolvedAt: new Date(),
      },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    void this.notifications
      .notifyDisputeResolved(
        updated.tenantId,
        updated.listing.ownerId,
        updated.listing.title,
        updated.id,
        updated.listingId,
        dto.decision,
      )
      .catch(() => {});

    return updated;
  }
}
