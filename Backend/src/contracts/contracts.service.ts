import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  signVerificationToken,
  generateVerificationQrPng,
  resolveVerificationSecret,
} from '../common/verification-token.util';
import {
  type Contract,
  type Prisma,
  type User,
  ContractType,
  Role,
} from '@prisma/client';

type BookingParty = { tenantId: string; listing: { ownerId: string } };

// Include Prisma partagé entre generateForBooking et downloadPdf : les deux
// ont besoin des mêmes relations (bailleur + locataire) pour, respectivement,
// notifier les parties et regénérer le PDF à la volée.
const bookingWithPartiesInclude = {
  listing: { include: { owner: true } },
  tenant: true,
} satisfies Prisma.BookingInclude;

type BookingWithParties = Prisma.BookingGetPayload<{
  include: typeof bookingWithPartiesInclude;
}>;

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private assertParty(booking: BookingParty, user: User): void {
    const isTenant = booking.tenantId === user.id;
    const isLandlord = booking.listing.ownerId === user.id;
    if (!isTenant && !isLandlord && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Not authorized');
    }
  }

  /**
   * Construit le PDF du contrat de bail à la volée à partir des données de
   * la réservation — jamais stocké : régénéré à chaque téléchargement, comme
   * le reçu de paiement (voir BookingsController.getReceipt). Ce choix évite
   * toute dépendance à un stockage tiers (l'ancienne version passait par
   * Cloudinary, dont le plan gratuit bloque la livraison des fichiers
   * PDF/ZIP — voir historique). Comme la génération est déterministe à
   * partir des données de la réservation (aucune signature électronique
   * n'est appliquée au fichier : le contrat est signé à la main en
   * personne), regénérer à chaque téléchargement produit un document
   * équivalent — `issuedAt` (la date de création du contrat, voir
   * `downloadPdf`) est passée explicitement pour que les mentions de date
   * d'émission restent figées, indépendamment de la date de téléchargement.
   */
  private async buildContractPdf(
    booking: BookingWithParties,
    issuedAt: Date,
  ): Promise<Buffer> {
    // QR de vérification d'identité locataire (voir verification-token.util
    // et BookingsService.verifyPublic) — incrusté dans le contrat pour que
    // le bailleur puisse en scanner l'authenticité en personne. Ne doit
    // jamais faire échouer la génération du contrat si le QR échoue.
    let qrCodeBuffer: Buffer | undefined;
    try {
      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
      const secret = resolveVerificationSecret(this.config, this.logger);
      const token = signVerificationToken(booking.id, secret);
      qrCodeBuffer = await generateVerificationQrPng(
        `${frontendUrl}/verifier/${token}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        'Génération du QR de vérification échouée (contrat) : ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }

    return this.pdf.generateLeaseContract(
      {
        bookingId: booking.id,
        landlord: {
          firstName: booking.listing.owner.firstName,
          lastName: booking.listing.owner.lastName,
          email: booking.listing.owner.email,
          phone: booking.listing.owner.phone,
        },
        tenant: {
          firstName: booking.tenant.firstName,
          lastName: booking.tenant.lastName,
          email: booking.tenant.email,
          phone: booking.tenant.phone,
        },
        listing: {
          title: booking.listing.title,
          type: booking.listing.type,
          address: booking.listing.address,
          city: booking.listing.city,
          region: booking.listing.region,
          rooms: booking.listing.rooms,
          surface: booking.listing.surface,
        },
        monthlyRent: Number(booking.listing.price),
        chargesIncluded: booking.listing.chargesIncluded,
        depositMonths: booking.listing.depositMonths ?? 0,
        depositAmount: Number(booking.depositAmount ?? 0),
        minLeaseMonths: booking.listing.minLeaseMonths ?? 1,
        moveInDate: booking.startDate,
        totalDueAtSigning: Number(booking.totalAmount),
        platformFee: Number(booking.platformFee ?? 0),
        issuedAt,
      },
      qrCodeBuffer,
    );
  }

  /**
   * Marque le contrat de bail comme prêt (et notifie les deux parties) pour
   * une réservation mensuelle qui vient de démarrer. Idempotent : si un
   * contrat existe déjà pour cette réservation, le retourne tel quel sans
   * rien régénérer. N'écrit plus de PDF nulle part : le fichier est
   * regénéré à la demande dans `downloadPdf` (voir `buildContractPdf`).
   * Appelée depuis PaymentsService.markBookingPaid — ne doit jamais faire
   * échouer la confirmation de paiement ; l'appelant doit encapsuler
   * l'appel dans un try/catch.
   */
  async generateForBooking(bookingId: string): Promise<Contract> {
    const existing = await this.prisma.contract.findUnique({
      where: { bookingId },
    });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingWithPartiesInclude,
    });

    const contract = await this.prisma.contract.create({
      data: {
        bookingId: booking.id,
        type: ContractType.HABITATION,
      },
    });

    this.notifications
      .notifyContractReady({
        tenantEmail: booking.tenant.email,
        tenantName: `${booking.tenant.firstName} ${booking.tenant.lastName}`,
        tenantId: booking.tenantId,
        landlordEmail: booking.listing.owner.email,
        landlordName: `${booking.listing.owner.firstName} ${booking.listing.owner.lastName}`,
        landlordId: booking.listing.ownerId,
        listingTitle: booking.listing.title,
        listingCity: booking.listing.city,
        bookingId: booking.id,
        totalAmount: Number(booking.totalAmount),
      })
      .catch((err: unknown) =>
        this.logger.error(
          'notifyContractReady échouée : ' +
            (err instanceof Error ? err.message : String(err)),
        ),
      );

    return contract;
  }

  async findByBooking(bookingId: string, user: User): Promise<Contract | null> {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { listing: { select: { ownerId: true } } },
    });
    this.assertParty(booking, user);
    return this.prisma.contract.findUnique({ where: { bookingId } });
  }

  /**
   * Télécharge le PDF du contrat — regénéré à la volée à partir des données
   * de la réservation (voir `buildContractPdf`) et retransmis directement,
   * exactement comme BookingsController.getReceipt pour le reçu de paiement.
   * Aucun aller-retour vers un stockage tiers.
   */
  async downloadPdf(bookingId: string, user: User): Promise<Buffer> {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingWithPartiesInclude,
    });
    this.assertParty(booking, user);

    const contract = await this.prisma.contract.findUnique({
      where: { bookingId },
    });
    if (!contract) {
      throw new NotFoundException('Contrat introuvable');
    }

    return this.buildContractPdf(booking, contract.createdAt);
  }
}
