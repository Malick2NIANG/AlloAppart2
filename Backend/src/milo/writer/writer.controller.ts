import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WriterService } from './writer.service';
import { WriteDescriptionDto } from './dto/write-description.dto';
import type { WriterResult } from './types';

@Controller('milo')
export class WriterController {
  constructor(private readonly writerService: WriterService) {}

  /**
   * Route authentifiée (comme la publication d'annonce, cf. Milo.md §
   * Writer) — pas de @Public() ici. Limite dédiée comme Milo Search/FAQ :
   * la génération déterministe reste bon marché, mais ce texte libre côté
   * client est une surface d'abus (spam) à limiter.
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('write-description')
  writeDescription(@Body() dto: WriteDescriptionDto): WriterResult {
    return this.writerService.write(dto);
  }
}
