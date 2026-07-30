import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BookingStatus,
  EscrowStatus,
  Booking,
  Listing,
  User,
} from '@prisma/client';
import axios from 'axios';
import { PaydunyaWebhookDto } from './dto/paydunya-webhook.dto';

type BookingWithDetails = Booking & { listing: Listing; tenant: User };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async initiate(bookingId: string, tenantId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { listing: true, tenant: true },
    });

    if (booking.tenantId !== tenantId) {
      throw new BadRequestException('Not authorized');
    }

    // ── Réutiliser l'URL PayDunya si un checkout a déjà été créé ────────────
    if (
      booking.status === BookingStatus.PENDING &&
      booking.paymentRef?.startsWith('PD-')
    ) {
      const token   = booking.paymentRef.replace('PD-', '');
      const isDev   = this.config.get<string>('NODE_ENV') !== 'production';
      const baseUrl = isDev
        ? 'https://paydunya.com/sandbox-checkout/invoice'
        : 'https://paydunya.com/checkout/invoice';
      this.logger.log(
        `[PayDunya] Réutilisation du checkout existant pour booking ${bookingId} → ${token}`,
      );
      return { payment_url: `${baseUrl}/${token}` };
    }
    // ────────────────────────────────────────────────────────────────────────

    return this.initiateWithPayDunya(booking, bookingId);
  }

  private async initiateWithPayDunya(
    booking: BookingWithDetails,
    bookingId: string,
  ) {
    const isDev       = this.config.get<string>('NODE_ENV') !== 'production';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    // ── Mode bypass dev : simule le paiement sans appeler PayDunya ──────────
    if (isDev && this.config.get<string>('PAYDUNYA_DEV_BYPASS') === 'true') {
      this.logger.warn(`[DEV BYPASS] Réservation ${bookingId} confirmée directement (${Number(booking.totalAmount)} FCFA)`);
      await this.prisma.booking.update({
        where: { id: bookingId },
        data:  {
          status:       BookingStatus.CONFIRMED,
          escrowStatus: EscrowStatus.HELD,
          paymentRef:   `DEV-BYPASS-${bookingId.slice(0, 8)}`,
        },
      });
      const fullBooking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { listing: { include: { owner: true } }, tenant: true },
      });
      if (fullBooking) {
        void this.notifications.notifyPaymentConfirmed({
          tenantEmail:    fullBooking.tenant.email,
          tenantName:     `${fullBooking.tenant.firstName} ${fullBooking.tenant.lastName}`,
          tenantId:       fullBooking.tenantId,
          landlordEmail:  fullBooking.listing.owner.email,
          landlordName:   `${fullBooking.listing.owner.firstName} ${fullBooking.listing.owner.lastName}`,
          landlordId:     fullBooking.listing.ownerId,
          listingTitle:   fullBooking.listing.title,
          listingCity:    fullBooking.listing.city,
          bookingId:      fullBooking.id,
          totalAmount:    Number(fullBooking.totalAmount),
          platformFee:    Number(fullBooking.platformFee ?? 0),
          landlordAmount: Number(fullBooking.landlordAmount ?? 0),
        }).catch(() => {});
      }
      return { payment_url: `${frontendUrl}/paiement/confirmation?booking_id=${bookingId}` };
    }

    const masterKey  = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token      = this.config.get<string>('PAYDUNYA_TOKEN');

    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException(
        'Service de paiement indisponible. Veuillez reessayer plus tard.',
      );
    }

    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const response = await axios
      .post<{ response_code: string; token: string; response_text: string }>(
        `${baseUrl}/checkout-invoice/create`,
        {
          invoice: {
            total_amount:  Number(booking.totalAmount),
            description:   `Reservation -- ${booking.listing.title}`,
            return_url:    `${frontendUrl}/paiement/confirmation?booking_id=${bookingId}`,
            cancel_url:    `${frontendUrl}/locataire/bookings/${bookingId}?status=cancel`,
            callback_url:  `${this.config.get<string>('BACKEND_URL')}/api/v1/payments/webhook/paydunya`,
          },
          store:       { name: 'AlloAppart' },
          custom_data: { booking_id: bookingId },
        },
        {
          headers: {
            'PAYDUNYA-MASTER-KEY':  masterKey,
            'PAYDUNYA-PRIVATE-KEY': privateKey,
            'PAYDUNYA-TOKEN':       token,
            'Content-Type':         'application/json',
          },
        },
      )
      .catch((err: unknown) => {
        const axiosErr = err as { response?: { status: number; data: unknown }; message?: string };
        this.logger.error(
          `PayDunya create-invoice ERREUR — status: ${axiosErr.response?.status ?? 'N/A'} — body: ${JSON.stringify(axiosErr.response?.data ?? axiosErr.message)}`,
        );
        throw new BadRequestException(
          'Service de paiement indisponible. Veuillez reessayer plus tard.',
        );
      });

    if (response.data.response_code !== '00') {
      this.logger.error(
        `PayDunya response_code inattendu : ${JSON.stringify(response.data)}`,
      );
      throw new BadRequestException(
        'Service de paiement indisponible. Veuillez reessayer plus tard.',
      );
    }

    // PayDunya retourne l'URL dans response_text (pas invoice_url)
    const invoiceUrl = response.data.response_text;
    if (!invoiceUrl) {
      this.logger.error(
        `PayDunya response_text absent malgré response_code 00 — réponse complète : ${JSON.stringify(response.data)}`,
      );
      throw new BadRequestException(
        'Service de paiement indisponible. Veuillez reessayer plus tard.',
      );
    }

    const paymentRef = `PD-${response.data.token}`;
    await this.prisma.booking.update({
      where: { id: bookingId },
      data:  { paymentRef },
    });

    return { payment_url: invoiceUrl, transId: paymentRef };
  }

  async handlePaydunyaWebhook(dto: PaydunyaWebhookDto) {
    const masterKey  = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token      = this.config.get<string>('PAYDUNYA_TOKEN');

    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException('PAYDUNYA_* manquant');
    }

    const isDev   = this.config.get<string>('NODE_ENV') !== 'production';
    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const confirm = await axios
      .get<{
        response_code: string;
        status:        string;
        custom_data:   { booking_id: string };
        invoice:       { total_amount: number };
      }>(`${baseUrl}/checkout-invoice/confirm/${dto.data}`, {
        headers: {
          'PAYDUNYA-MASTER-KEY':  masterKey,
          'PAYDUNYA-PRIVATE-KEY': privateKey,
          'PAYDUNYA-TOKEN':       token,
        },
      })
      .catch(() => {
        throw new BadRequestException(
          'Impossible de confirmer le paiement PayDunya',
        );
      });

    const { status, custom_data, invoice } = confirm.data;
    const bookingId = custom_data?.booking_id;
    if (!bookingId) return { ok: true };

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) return { ok: true };

    if (
      booking.status === BookingStatus.CONFIRMED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      return { ok: true };
    }

    const expectedAmount = Number(booking.totalAmount);
    const paidAmount     = Number(invoice?.total_amount ?? 0);
    if (Math.abs(paidAmount - expectedAmount) > 1) {
      this.logger.warn(
        `PayDunya montant incohérent : attendu ${expectedAmount}, recu ${paidAmount} pour booking ${bookingId}`,
      );
      throw new BadRequestException('Inconsistent payment amount');
    }

    if (status === 'completed') {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status:       BookingStatus.CONFIRMED,
          escrowStatus: EscrowStatus.HELD,
          paymentRef:   `PD-${dto.data}`,
        },
      });
      const fullBooking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { listing: { include: { owner: true } }, tenant: true },
      });
      if (fullBooking) {
        void this.notifications.notifyPaymentConfirmed({
          tenantEmail:    fullBooking.tenant.email,
          tenantName:     `${fullBooking.tenant.firstName} ${fullBooking.tenant.lastName}`,
          tenantId:       fullBooking.tenantId,
          landlordEmail:  fullBooking.listing.owner.email,
          landlordName:   `${fullBooking.listing.owner.firstName} ${fullBooking.listing.owner.lastName}`,
          landlordId:     fullBooking.listing.ownerId,
          listingTitle:   fullBooking.listing.title,
          listingCity:    fullBooking.listing.city,
          bookingId:      fullBooking.id,
          totalAmount:    Number(fullBooking.totalAmount),
          platformFee:    Number(fullBooking.platformFee ?? 0),
          landlordAmount: Number(fullBooking.landlordAmount ?? 0),
        }).catch(() => {});
      }
    } else {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status:       BookingStatus.CANCELLED,
          escrowStatus: EscrowStatus.REFUNDED,
        },
      });
    }

    return { ok: true };
  }

  /**
   * Vérification active du paiement PayDunya depuis la page de confirmation.
   * Appelée quand le locataire revient sur /paiement/confirmation après avoir payé.
   * Interroge directement PayDunya — indépendant du webhook.
   */
  async verifyBooking(bookingId: string, tenantId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    if (booking.tenantId !== tenantId) {
      throw new BadRequestException('Not authorized');
    }

    // Déjà confirmé — rien à faire
    if (booking.status === BookingStatus.CONFIRMED) {
      return booking;
    }

    // Pas de référence PayDunya — paiement jamais initié
    if (!booking.paymentRef?.startsWith('PD-')) {
      return booking;
    }

    const pdToken    = booking.paymentRef.replace('PD-', '');
    const masterKey  = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token      = this.config.get<string>('PAYDUNYA_TOKEN');

    if (!masterKey || !privateKey || !token) return booking;

    const isDev   = this.config.get<string>('NODE_ENV') !== 'production';
    const baseUrl = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const confirm = await axios
      .get<{
        response_code: string;
        status:        string;
        custom_data:   { booking_id: string };
        invoice:       { total_amount: number };
      }>(`${baseUrl}/checkout-invoice/confirm/${pdToken}`, {
        headers: {
          'PAYDUNYA-MASTER-KEY':  masterKey,
          'PAYDUNYA-PRIVATE-KEY': privateKey,
          'PAYDUNYA-TOKEN':       token,
        },
      })
      .catch(() => null);

    if (!confirm || confirm.data.status !== 'completed') {
      return booking; // paiement pas encore finalisé
    }

    // Vérification du montant
    const expectedAmount = Number(booking.totalAmount);
    const paidAmount     = Number(confirm.data.invoice?.total_amount ?? 0);
    if (Math.abs(paidAmount - expectedAmount) > 1) {
      this.logger.warn(
        `verifyBooking — montant incohérent : attendu ${expectedAmount}, reçu ${paidAmount}`,
      );
      throw new BadRequestException('Inconsistent payment amount');
    }

    // Confirmer la réservation
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data:  {
        status:       BookingStatus.CONFIRMED,
        escrowStatus: EscrowStatus.HELD,
      },
      include: { listing: { include: { owner: true } }, tenant: true },
    });

    void this.notifications.notifyPaymentConfirmed({
      tenantEmail:    updated.tenant.email,
      tenantName:     `${updated.tenant.firstName} ${updated.tenant.lastName}`,
      tenantId:       updated.tenantId,
      landlordEmail:  updated.listing.owner.email,
      landlordName:   `${updated.listing.owner.firstName} ${updated.listing.owner.lastName}`,
      landlordId:     updated.listing.ownerId,
      listingTitle:   updated.listing.title,
      listingCity:    updated.listing.city,
      bookingId:      updated.id,
      totalAmount:    Number(updated.totalAmount),
      platformFee:    Number(updated.platformFee  ?? 0),
      landlordAmount: Number(updated.landlordAmount ?? 0),
    }).catch(() => {});

    this.logger.log(
      `[verifyBooking] Booking ${bookingId} confirmé via vérification active`,
    );
    return updated;
  }

  async release(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    if (booking.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Impossible de liberer un escrow en statut ${booking.escrowStatus}`,
      );
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data:  { escrowStatus: EscrowStatus.RELEASED },
    });
  }

  async refund(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    if (booking.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Impossible de rembourser un escrow en statut ${booking.escrowStatus}`,
      );
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data:  { escrowStatus: EscrowStatus.REFUNDED },
    });
  }
}
