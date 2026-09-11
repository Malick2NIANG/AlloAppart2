import { Controller, Get, Param, Post } from '@nestjs/common';
import { AgencesService } from './agences.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('agences')
export class AgencesController {
  constructor(private readonly agencesService: AgencesService) {}

  /** Liste publique de toutes les agences */
  @Public()
  @Get()
  findAll() {
    return this.agencesService.findAll();
  }

  /** Profil public d'une agence par slug */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.agencesService.findBySlug(slug);
  }

  /** Incrémenter les vues de la vitrine (appelé côté client au chargement) */
  @Public()
  @Post(':slug/view')
  trackView(@Param('slug') slug: string) {
    void this.agencesService.incrementProfileViews(slug);
    return { ok: true };
  }
}
