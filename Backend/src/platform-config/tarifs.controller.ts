import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PlatformConfigService } from './platform-config.service';

/**
 * Route publique dédiée (lot « page /tarifs ») — volontairement séparée de
 * PlatformConfigController (`admin/config`, protégé ADMIN) : /tarifs est le
 * nom de la page publique qui la consomme, jamais sous un préfixe `admin`.
 * Limite dédiée : page marketing peu consultée en boucle, pas besoin de la
 * limite globale (100/min) mais une limite y reste nécessaire (surface
 * publique sans authentification).
 */
@Controller('tarifs')
export class TarifsController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get()
  getPublicPricing() {
    return this.platformConfigService.getPublicPricing();
  }
}
