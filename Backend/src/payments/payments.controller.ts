import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaydunyaWebhookDto } from './dto/paydunya-webhook.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
