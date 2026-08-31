import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaydunyaWebhookDto } from './dto/paydunya-webhook.dto';
import { SoftpayPaymentDto } from './dto/softpay-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly softpay: PaydunyaSoftpayService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Post('initiate')
  initiate(@CurrentUser() user: User, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto.bookingId, user.id);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('webhook/paydunya')
  webhookPaydunya(@Body() dto: PaydunyaWebhookDto) {
    return this.paymentsService.handlePaydunyaWebhook(dto);
  }

  /** Vérification active — appelée depuis la page /paiement/confirmation */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Post('verify/:bookingId')
  verify(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.verifyBooking(bookingId, user.id);
  }

  // ── SOFTPAY / PSR — paiement sans redirection (UI custom AlloAppart) ─────
  // Génériques : réutilisés par réservations, boost d'annonce et abonnements,
  // le paymentToken identifiant déjà l'invoice PayDunya concernée.

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('softpay/orange-money')
  softpayOrangeMoney(@Body() dto: SoftpayPaymentDto, @CurrentUser() user: User) {
    return this.softpay.payWithOrangeMoney({
      paymentToken: dto.paymentToken,
      phone: dto.phone,
      customerName: `${user.firstName} ${user.lastName}`.trim(),
      customerEmail: user.email,
    });
  }

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('softpay/wave')
  softpayWave(@Body() dto: SoftpayPaymentDto, @CurrentUser() user: User) {
    return this.softpay.payWithWave({
      paymentToken: dto.paymentToken,
      phone: dto.phone,
      customerName: `${user.firstName} ${user.lastName}`.trim(),
      customerEmail: user.email,
    });
  }

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('softpay/free-money')
  softpayFreeMoney(@Body() dto: SoftpayPaymentDto, @CurrentUser() user: User) {
    return this.softpay.payWithFreeMoney({
      paymentToken: dto.paymentToken,
      phone: dto.phone,
      customerName: `${user.firstName} ${user.lastName}`.trim(),
      customerEmail: user.email,
    });
  }

  @Roles(Role.ADMIN)
  @Post('release/:bookingId')
  release(@Param('bookingId') bookingId: string) {
    return this.paymentsService.release(bookingId);
  }

  @Roles(Role.ADMIN)
  @Post('refund/:bookingId')
  refund(@Param('bookingId') bookingId: string) {
    return this.paymentsService.refund(bookingId);
  }
}
