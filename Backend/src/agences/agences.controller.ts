import { Controller, Get, Param, Post } from '@nestjs/common';
import { AgencesService } from './agences.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('agences')
export class AgencesController {
  constructor(private readonly agencesService: AgencesService) {}

  /** Liste publique de toutes les agences (jamais de téléphone — voir AGENCY_PUBLIC_SELECT) */
  @Public()
  @Get()
  findAll() {
    return this.agencesService.findAll();
  }

  /** Profil public d'une agence par slug (jamais de téléphone — voir AGENCY_PUBLIC_SELECT) */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.agencesService.findBySlug(slug);
  }

  // Pas de @Public() : nécessite un visiteur connecté, condition minimale
  // pour même espérer avoir une réservation qualifiante (Task #120).
  /** Révèle le vrai téléphone si l'utilisateur connecté a une réservation confirmée avec cette agence */
  @Get(':slug/phone')
  getPhone(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.agencesService.getPhoneForViewer(slug, user.id);
  }

  /** Incrémenter les vues de la vitrine (appelé côté client au chargement) */
  @Public()
  @Post(':slug/view')
  trackView(@Param('slug') slug: string) {
    void this.agencesService.incrementProfileViews(slug);
    return { ok: true };
  }
}
