import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { type User, Role } from '@prisma/client';
import { InitiateSubscriptionDto } from './dto/initiate-subscription.dto';
import { AdminExtendDto } from './dto/admin-extend.dto';
import { PaydunyaWebhookDto } from '../payments/dto/paydunya-webhook.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Uniquement PRO_AGENCE — les BAILLEURs individuels paient à la commission, pas d'abonnement
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Roles(Role.PRO_AGENCE)
  @Post('initiate')
  initiate(@CurrentUser() user: User, @Body() dto: InitiateSubscriptionDto) {
    return this.subscriptionsService.initiate(user.id, dto.plan);
  }

  @Roles(Role.PRO_AGENCE, Role.ADMIN)
  @Get('me')
  findMine(@CurrentUser() user: User) {
    return this.subscriptionsService.findMine(user.id);
  }

  @Roles(Role.PRO_AGENCE)
  @Post('cancel')
  cancel(@CurrentUser() user: User) {
    return this.subscriptionsService.cancel(user.id);
  }

  // Niveau d'alerte — uniquement PRO_AGENCE (elles ont un abonnement mensuel à surveiller)
  @Roles(Role.PRO_AGENCE, Role.ADMIN)
  @Get('me/alert')
  getAlert(@CurrentUser() user: User) {
    return this.subscriptionsService.getAlert(user.id);
  }

  @Roles(Role.ADMIN)
  @Get('all')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.subscriptionsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(Role.ADMIN)
  @Patch(':id/suspend')
  suspendById(@Param('id') id: string) {
    return this.subscriptionsService.suspendById(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/activate')
  activateById(@Param('id') id: string) {
    return this.subscriptionsService.activateById(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/extend')
  extendById(@Param('id') id: string, @Body() dto: AdminExtendDto) {
    return this.subscriptionsService.extendById(id, dto.days ?? 30);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('webhook/paydunya')
  webhookPaydunya(@Body() dto: PaydunyaWebhookDto) {
    return this.subscriptionsService.handlePaydunyaWebhook(dto);
  }
}
