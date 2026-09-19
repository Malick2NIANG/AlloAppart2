import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  // Messages vocaux
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
  // Vidéos d'annonce (cf. ImageUploadZone.tsx VIDEO_TYPES — même liste,
  // sinon le front laisse l'utilisateur déposer une vidéo qui se fait
  // systématiquement refuser ici).
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
];
// 200 MB pour couvrir les vidéos (cf. ImageUploadZone.tsx MAX_VIDEO_SIZE) —
// les images/audio restent bien plus légers en pratique, cette limite n'est
// qu'un plafond de sécurité côté serveur.
const MAX_SIZE_BYTES = 200 * 1024 * 1024;

// Tout utilisateur authentifié peut uploader des images.
// La restriction BAILLEUR s'applique à la création d'annonce (ListingsController).
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        // Le navigateur peut envoyer un MIME avec codec ex: "audio/webm;codecs=opus"
        // On compare uniquement la partie avant le ";"
        const baseType = file.mimetype.split(';')[0].trim();
        if (!ALLOWED_MIME.includes(baseType)) {
          return cb(
            new BadRequestException('Format non supporté (jpg, png, webp, audio, vidéo)'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadFile(file);
  }
}
