import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Post('initiate')
  initiate(@CurrentUser() user: User, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto.bookingId, user.id);
  }

  // Body non typé par un DTO class-validator : le payload IPN PayDunya est
  // imbriqué et sa forme dépend du moyen de paiement (carte, mobile money) —
  // `verifyAndParseCallback` (PaydunyaSoftpayService) valide et extrait tout
  // ce qui compte à partir de ce corps brut, hash de signature inclus.
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('webhook/paydunya')
  webhookPaydunya(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handlePaydunyaWebhook(body);
  }

  /** Vérification active — appelée depuis la page /paiement/confirmation */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.LOCATAIRE)
  @Post('verify/:bookingId')
  verify(@Param('bookingId') bookingId: string, @CurrentUser() user: User) {
    return this.paymentsService.verifyBooking(bookingId, user.id);
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
