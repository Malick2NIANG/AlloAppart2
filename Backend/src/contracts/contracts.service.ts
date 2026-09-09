import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  type Contract,
  type User,
  ContractStatus,
  ContractType,
  Role,
} from '@prisma/client';

type BookingParty = { tenantId: string; listing: { ownerId: string } };

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly upload: UploadService,
    private readonly notifications: NotificationsService,
  ) {}

  private assertParty(booking: BookingParty, user: User): void {
    const isTenant = booking.tenantId === user.id;
    const isLandlord = booking.listing.ownerId === user.id;
    if (!isTenant && !isLandlord && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Not authorized');
    }
  }

  /**
   * Génère le contrat de bail (DRAFT -> AWAITING_FIRST_SIGNATURE) pour une
   * réservation mensuelle qui vient de démarrer. Idempotent : si un contrat
   * existe déjà pour cette réservation, le retourne tel quel sans le
   * régénérer. Appelée depuis PaymentsService.markBookingPaid — ne doit
   * jamais faire échouer la confirmation de paiement ; l'appelant doit
   * encapsuler l'appel dans un try/catch.
   */
  async generateForBooking(bookingId: string): Promise<Contract> {
    const existing = await this.prisma.contract.findUnique({
      where: { bookingId },
    });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    const pdfBuffer = await this.pdf.generateLeaseContract({
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
    });

    const { url } = await this.upload.uploadPdfBuffer(
      pdfBuffer,
      `contrat-${booking.id}-draft-${Date.now()}.pdf`,
    );

    const contract = await this.prisma.contract.create({
      data: {
        bookingId: booking.id,
        type: ContractType.HABITATION,
        status: ContractStatus.AWAITING_FIRST_SIGNATURE,
        pdfUrl: url,
      },
    });

    this.notifications
      .notifyContractAwaitingSignature({
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
          'notifyContractAwaitingSignature échouée : ' +
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
   * Upload du PDF signé — ordre séquentiel obligatoire : le Locataire signe
   * en premier (AWAITING_FIRST_SIGNATURE -> AWAITING_SECOND_SIGNATURE), puis
   * le Bailleur/Agence finalise (-> FULLY_SIGNED). Chaque partie ne peut
   * signer qu'à son tour.
   */
  async uploadSigned(
    contractId: string,
    user: User,
    file: Express.Multer.File,
  ): Promise<Contract> {
    if (!file?.buffer || !this.upload.isPdf(file.buffer)) {
      throw new BadRequestException('Fichier invalide : un PDF est attendu');
    }

    const contract = await this.prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: {
        booking: {
          include: { listing: { include: { owner: true } }, tenant: true },
        },
      },
    });

    const booking = contract.booking;
    const isTenant = booking.tenantId === user.id;
    const isLandlord = booking.listing.ownerId === user.id;
    if (!isTenant && !isLandlord) {
      throw new ForbiddenException('Not authorized');
    }

    if (contract.status === ContractStatus.AWAITING_FIRST_SIGNATURE) {
      if (!isTenant) {
        throw new BadRequestException(
          "C'est au tour du locataire de signer en premier.",
        );
      }
      const { url } = await this.upload.uploadPdfBuffer(
        file.buffer,
        `contrat-${booking.id}-signe-locataire-${Date.now()}.pdf`,
      );
      const updated = await this.prisma.contract.update({
        where: { id: contractId },
        data: {
          firstSignedPdfUrl: url,
          firstSignedById: user.id,
          firstSignedAt: new Date(),
          status: ContractStatus.AWAITING_SECOND_SIGNATURE,
        },
      });

      this.notifications
        .notifyContractCounterSignature({
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
            'notifyContractCounterSignature échouée : ' +
              (err instanceof Error ? err.message : String(err)),
          ),
        );

      return updated;
    }

    if (contract.status === ContractStatus.AWAITING_SECOND_SIGNATURE) {
      if (!isLandlord) {
        throw new BadRequestException(
          isTenant
            ? 'Vous avez déjà signé ce contrat.'
            : "C'est au tour du bailleur de signer.",
        );
      }
      const { url } = await this.upload.uploadPdfBuffer(
        file.buffer,
        `contrat-${booking.id}-final-${Date.now()}.pdf`,
      );
      const updated = await this.prisma.contract.update({
        where: { id: contractId },
        data: {
          finalPdfUrl: url,
          secondSignedAt: new Date(),
          status: ContractStatus.FULLY_SIGNED,
        },
      });

      this.notifications
        .notifyContractFullySigned({
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
            'notifyContractFullySigned échouée : ' +
              (err instanceof Error ? err.message : String(err)),
          ),
        );

      return updated;
    }

    throw new BadRequestException(
      'Ce contrat ne peut plus être signé (statut : ' + contract.status + ').',
    );
  }
}
