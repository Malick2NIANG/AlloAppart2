import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  private hasMagicBytes(buf: Buffer): boolean {
    if (buf.length < 12) return false;
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    )
      return true;
    // WebP: RIFF????WEBP
    if (
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP'
    )
      return true;
    // HEIC/HEIF: ftyp box at offset 4, brand doit être HEIC/HEIF/HEIX/HEVC/MIF1/MSF1
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
      const brand = buf.slice(8, 12).toString('ascii');
      if (
        [
          'heic',
          'heix',
          'hevc',
          'hevx',
          'mif1',
          'msf1',
          'MiHE',
          'MiHB',
        ].includes(brand)
      )
        return true;
    }
    return false;
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (!this.hasMagicBytes(file.buffer)) {
      throw new BadRequestException(
        'Fichier invalide : signature non reconnue',
      );
    }

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!cloudName) throw new BadRequestException('Cloudinary non configuré');

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'allo-appart/listings',
          resource_type: 'image',
          transformation: [
            { width: 1280, height: 960, crop: 'limit', quality: 'auto:good' },
          ],
        },
        (error, result) => {
          if (error || !result)
            return reject(
              error instanceof Error ? error : new Error('Upload échoué'),
            );
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }
}
