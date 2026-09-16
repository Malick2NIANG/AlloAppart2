import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
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

  // Le frontend ne doit jamais appeler directement l'URL Cloudinary stockée
  // (`Contract.pdfUrl`) — ce compte refuse l'accès public aux ressources
  // raw/PDF (401 constaté par l'utilisateur). Cet endpoint, authentifié
  // comme le reste de l'API, signe l'URL Cloudinary côté serveur et
  // retransmet le PDF — même principe que BookingsController.getReceipt.
  @Get('booking/:bookingId/download')
  async download(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const buffer = await this.contractsService.downloadPdf(bookingId, user);
    const filename = `contrat-${bookingId.slice(0, 8).toUpperCase()}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
