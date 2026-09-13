import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  signVerificationToken,
  generateVerificationQrPng,
  resolveVerificationSecret,
} from '../common/verification-token.util';
import { type Contract, type User, ContractType, Role } from '@prisma/client';

type BookingParty = { tenantId: string; listing: { ownerId: string } };

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly upload: UploadService,
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
   * Génère le contrat de bail (PDF avec espaces libres pour les informations
   * privées, à compléter et signer manuscritement en personne) pour une
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

    const pdfBuffer = await this.pdf.generateLeaseContract(
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
      },
      qrCodeBuffer,
    );

    const { url } = await this.upload.uploadPdfBuffer(
      pdfBuffer,
      `contrat-${booking.id}-draft-${Date.now()}.pdf`,
    );

    const contract = await this.prisma.contract.create({
      data: {
        bookingId: booking.id,
        type: ContractType.HABITATION,
        pdfUrl: url,
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
}
