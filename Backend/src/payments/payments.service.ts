import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, EscrowStatus } from '@prisma/client';
import { createHmac } from 'crypto';
import axios from 'axios';
import { CinetpayWebhookDto } from './dto/cinetpay-webhook.dto';

@Injectable()
export class PaymentsService {
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
      return_url: `${this.config.get<string>('FRONTEND_URL')}/bookings/${bookingId}?status=success`,
      cancel_url: `${this.config.get<string>('FRONTEND_URL')}/bookings/${bookingId}?status=cancel`,
      notify_url: `${this.config.get<string>('API_URL')}/api/v1/payments/webhook`,
      customer_name: booking.tenant.firstName,
      customer_surname: booking.tenant.lastName,
      customer_phone_number: booking.tenant.phone ?? '',
      customer_email: booking.tenant.email,
      customer_city: 'Dakar',
      customer_country: 'SN',
    };

    const response = await axios
      .post<{ data: { payment_url: string } }>(
        'https://api-checkout.cinetpay.com/v2/payment',
        payload,
      )
      .catch(() => {
        throw new BadRequestException('Service de paiement indisponible. Veuillez réessayer plus tard.');
      });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentRef: transId },
    });

    return { payment_url: response.data.data.payment_url, transId };
  }

  async handleWebhook(payload: CinetpayWebhookDto) {
    const secret = this.config.get<string>('CINETPAY_SECRET_KEY');
    if (!secret) throw new BadRequestException('CINETPAY_SECRET_KEY manquant');

    const expected = createHmac('sha256', secret)
      .update(payload.cpm_site_id + payload.cpm_trans_id + payload.cpm_trans_date)
      .digest('hex');
    if (expected !== payload.signature) {
      throw new BadRequestException('Signature invalide');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { paymentRef: payload.cpm_trans_id },
    });

    if (!booking) return { ok: true };

    // Idempotence : ne pas retraiter un booking déjà confirmé ou complété
    if (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED) {
      return { ok: true };
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
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(`Impossible de libérer un escrow en statut ${booking.escrowStatus}`);
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { escrowStatus: EscrowStatus.RELEASED },
    });
  }

  async refund(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.escrowStatus === EscrowStatus.RELEASED || booking.escrowStatus === EscrowStatus.REFUNDED) {
      throw new BadRequestException(`Impossible de rembourser un escrow en statut ${booking.escrowStatus}`);
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { escrowStatus: EscrowStatus.REFUNDED },
    });
  }
}
