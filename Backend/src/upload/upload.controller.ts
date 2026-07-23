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
];
const MAX_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB (vocaux inclus)

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
            new BadRequestException('Format non supporté (jpg, png, webp, audio)'),
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
