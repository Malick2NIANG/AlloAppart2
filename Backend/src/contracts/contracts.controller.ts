import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContractsService } from './contracts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

const MAX_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB

// Aucun @Roles ici : locataire et bailleur/agence doivent tous les deux
// pouvoir consulter/signer — l'autorisation fine (partie prenante à la
// réservation) est vérifiée côté service.
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

  // Upload du PDF signé — locataire en premier, puis bailleur/agence.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':id/sign')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        const baseType = file.mimetype.split(';')[0].trim();
        if (baseType !== 'application/pdf') {
          return cb(
            new BadRequestException('Seuls les fichiers PDF sont acceptés'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadSigned(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return this.contractsService.uploadSigned(id, user, file);
  }
}
