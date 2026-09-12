import { Controller, Get, Param } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

// Aucun @Roles ici : locataire et bailleur/agence doivent tous les deux
// pouvoir consulter le contrat — l'autorisation fine (partie prenante à la
// réservation) est vérifiée côté service. Pas de signature électronique :
// le PDF généré (avec espaces libres pour les infos privées) est signé à
// la main par les deux parties lors de leur rencontre en personne.
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('booking/:bookingId')
  findByBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.findByBooking(bookingId, user);
  }
}
