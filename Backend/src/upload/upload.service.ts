import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key:    this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!cloudName) throw new BadRequestException('Cloudinary non configuré');

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'allo-appart/listings',
          resource_type: 'image',
          transformation: [{ width: 1280, height: 960, crop: 'limit', quality: 'auto:good' }],
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Upload échoué'));
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }
}
