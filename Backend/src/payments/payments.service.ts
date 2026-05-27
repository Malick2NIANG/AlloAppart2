import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, EscrowStatus } from '@prisma/client';
import { timingSafeEqual, createHmac } from 'crypto';
import axios from 'axios';
import { CinetpayWebhookDto } from './dto/cinetpay-webhook.dto';

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
      throw new BadRequestException('Non autorisé');
    }

    const transId = `AA-${bookingId}-${Date.now()}`;

    const payload = {
      apikey: this.config.get<string>('CINETPAY_API_KEY'),
      site_id: this.config.get<string>('CINETPAY_SITE_ID'),
      transaction_id: transId,
      amount: Number(booking.totalAmount),
      currency: 'XOF',
      description: `Réservation — ${booking.listing.title}`,
      return_url: `${this.config.get<string>('FRONTEND_URL')}/paiement/confirmation?booking_id=${bookingId}`,
      cancel_url: `${this.config.get<string>('FRONTEND_URL')}/bookings/${bookingId}?status=cancel`,
      notify_url: `${this.config.get<string>('BACKEND_URL')}/api/v1/payments/webhook`,
      customer_name: booking.tenant.firstName,
      customer_surname: booking.tenant.lastName,
      customer_phone_number: booking.tenant.phone ?? '',
      customer_email: booking.tenant.email,
      customer_city: 'Dakar',
      customer_country: 'SN',
    };

    const response = await axios
      .post<{
        data: { payment_url: string };
      }>('https://api-checkout.cinetpay.com/v2/payment', payload)
      .catch(() => {
        throw new BadRequestException(
          'Service de paiement indisponible. Veuillez réessayer plus tard.',
        );
      });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentRef: transId },
    });

    return { payment_url: response.data.data.payment_url, transId };
  }

  private parseWebhookDate(raw: string): Date {
    // CinetPay format : YYYYMMDDHHMMSS
    const y = parseInt(raw.slice(0, 4), 10);
    const mo = parseInt(raw.slice(4, 6), 10) - 1;
    const d = parseInt(raw.slice(6, 8), 10);
    const h = parseInt(raw.slice(8, 10), 10);
    const mi = parseInt(raw.slice(10, 12), 10);
    const s = parseInt(raw.slice(12, 14), 10);
    return new Date(Date.UTC(y, mo, d, h, mi, s));
  }

  async handleWebhook(payload: CinetpayWebhookDto) {
    const secret = this.config.get<string>('CINETPAY_SECRET_KEY');
    if (!secret) throw new BadRequestException('CINETPAY_SECRET_KEY manquant');

    const expected = createHmac('sha256', secret)
      .update(
        payload.cpm_site_id + payload.cpm_trans_id + payload.cpm_trans_date,
      )
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(payload.signature ?? '', 'hex');
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      throw new BadRequestException('Signature invalide');
    }

    // Rejeter les webhooks trop anciens (protection contre replay)
    const webhookDate = this.parseWebhookDate(payload.cpm_trans_date);
    const ageMs = Date.now() - webhookDate.getTime();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (isNaN(ageMs) || ageMs > ONE_HOUR_MS || ageMs < -60_000) {
      this.logger.warn(
        `Webhook CinetPay rejeté — horodatage hors fenêtre : ${payload.cpm_trans_date}`,
      );
      throw new BadRequestException('Webhook expiré ou horodatage invalide');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { paymentRef: payload.cpm_trans_id },
    });

    if (!booking) return { ok: true };

    // Idempotence : ne pas retraiter un booking déjà confirmé ou complété
    if (
      booking.status === BookingStatus.CONFIRMED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      return { ok: true };
    }

    // Vérification du montant — le montant payé doit correspondre au montant attendu
    const expectedAmount = Number(booking.totalAmount);
    const paidAmount = Number(payload.cpm_amount);
    if (Math.abs(paidAmount - expectedAmount) > 1) {
      this.logger.warn(
        `Montant webhook incohérent : attendu ${expectedAmount}, reçu ${paidAmount} pour booking ${booking.id}`,
      );
      throw new BadRequestException('Montant du paiement incohérent');
    }

    if (payload.cpm_result === '00') {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          escrowStatus: EscrowStatus.HELD,
        },
      });
    } else {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
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
        `Impossible de libérer un escrow en statut ${booking.escrowStatus}`,
      );
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { escrowStatus: EscrowStatus.RELEASED },
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
      data: { escrowStatus: EscrowStatus.REFUNDED },
    });
  }
}
