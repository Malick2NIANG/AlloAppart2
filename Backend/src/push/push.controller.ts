import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

/** Toutes les routes exigent un utilisateur connecté (garde globale Clerk,
 * aucun `@Public()` ici) — jamais d'accès à l'abonnement/aux préférences
 * d'un autre utilisateur, `userId` vient toujours de `@CurrentUser()`,
 * jamais du corps de la requête. */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('vapid-public-key')
  vapidPublicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('subscribe')
  @HttpCode(200)
  subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: User) {
    return this.push.subscribe(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete('subscribe')
  @HttpCode(204)
  async unsubscribe(@Body() dto: UnsubscribeDto, @CurrentUser() user: User) {
    await this.push.unsubscribe(user.id, dto.endpoint);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: User) {
    return this.push.getPreferences(user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch('preferences')
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: User,
  ) {
    return this.push.updatePreferences(user.id, dto);
  }
}
