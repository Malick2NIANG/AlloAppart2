import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
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
  ) {}

  async initiate(bookingId: string, tenantId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { listing: true, tenant: true },
    });

    if (booking.tenantId !== tenantId) {
      throw new BadRequestException('Non autorise');
    }

    return this.initiateWithPayDunya(booking, bookingId);
  }

  private async initiateWithPayDunya(
    booking: BookingWithDetails,
    bookingId: string,
  ) {
    const masterKey  = this.config.get<string>('PAYDUNYA_MASTER_KEY');
    const privateKey = this.config.get<string>('PAYDUNYA_PRIVATE_KEY');
    const token      = this.config.get<string>('PAYDUNYA_TOKEN');

    if (!masterKey || !privateKey || !token) {
      throw new BadRequestException(
        'Service de paiement indisponible. Veuillez reessayer plus tard.',
      );
    }

    const isDev    = this.config.get<string>('NODE_ENV') !== 'production';
    const baseUrl  = isDev
      ? 'https://app.paydunya.com/sandbox-api/v1'
      : 'https://app.paydunya.com/api/v1';

    const response = await axios
      .post<{ response_code: string; token: string; invoice_url: string }>(
        `${baseUrl}/checkout-invoice/create`,
        {
          invoice: {
            total_amount:  Number(booking.totalAmount),
            description:   `Reservation -- ${booking.listing.title}`,
            return_url:    `${this.config.get<string>('FRONTEND_URL')}/paiement/confirmation?booking_id=${bookingId}`,
            cancel_url:    `${this.config.get<string>('FRONTEND_URL')}/bookings/${bookingId}?status=cancel`,
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
      .catch(() => {
        throw new BadRequestException(
          'Service de paiement indisponible. Veuillez reessayer plus tard.',
        );
      });

    if (response.data.response_code !== '00') {
      throw new BadRequestException(
        'Service de paiement indisponible. Veuillez reessayer plus tard.',
      );
    }

    const paymentRef = `PD-${response.data.token}`;
    await this.prisma.booking.update({
      where: { id: bookingId },
      data:  { paymentRef },
    });

    return { payment_url: response.data.invoice_url, transId: paymentRef };
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
      throw new BadRequestException('Montant du paiement incohérent');
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
