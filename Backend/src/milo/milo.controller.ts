import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { MiloService, type ParseQueryResponse } from './milo.service';
import { ParseQueryDto } from './dto/parse-query.dto';

@Controller('search')
export class MiloController {
  constructor(private readonly miloService: MiloService) {}

  /**
   * Route publique (visiteurs anonymes) — ne renvoie jamais d'annonce,
   * uniquement des filtres à passer ensuite à GET /listings (lot 4, cf.
   * Milo.md § 3.4). Limite dédiée plus stricte que la limite globale
   * (100/min) : une recherche en langage naturel est plus coûteuse à
   * calculer qu'un GET simple, et ce texte libre est une surface d'abus
   * (spam, scraping) un peu plus sensible.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('parse-query')
  parseQuery(@Body() dto: ParseQueryDto): ParseQueryResponse {
    return this.miloService.parseQuery(dto);
  }
}
