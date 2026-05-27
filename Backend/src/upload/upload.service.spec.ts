import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

function makeBuffer(bytes: number[], total = 20): Buffer {
  const buf = Buffer.alloc(total);
  bytes.forEach((b, i) => buf.writeUInt8(b, i));
  return buf;
}

function jpegBuf(): Buffer {
  return makeBuffer([0xff, 0xd8, 0xff, 0xe0]);
}

function pngBuf(): Buffer {
  return makeBuffer([0x89, 0x50, 0x4e, 0x47]);
}

function webpBuf(): Buffer {
  const buf = Buffer.alloc(20);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WEBP', 8, 'ascii');
  return buf;
}

function heicBuf(brand = 'heic'): Buffer {
  const buf = Buffer.alloc(20);
  buf.write('ftyp', 4, 'ascii');
  buf.write(brand, 8, 'ascii');
  return buf;
}

function mp4Buf(): Buffer {
  return heicBuf('mp42');
}

function multerFile(buffer: Buffer): Express.Multer.File {
  return {
    buffer,
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: buffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('UploadService — hasMagicBytes', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'CLOUDINARY_CLOUD_NAME') return 'test-cloud';
              if (key === 'CLOUDINARY_API_KEY') return 'key';
              if (key === 'CLOUDINARY_API_SECRET') return 'secret';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);

    (jest.spyOn(cloudinary.uploader, 'upload_stream') as jest.Mock).mockImplementation(
      (_opts: unknown, callback: (err: unknown, result: unknown) => void) => {
        callback(null, {
          secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
          public_id: 'allo-appart/listings/test',
        });
        return { end: jest.fn() };
      },
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepte un JPEG valide', async () => {
    const result = await service.uploadFile(multerFile(jpegBuf()));
    expect(result.url).toContain('cloudinary.com');
  });

  it('accepte un PNG valide', async () => {
    await expect(service.uploadFile(multerFile(pngBuf()))).resolves.toBeDefined();
  });

  it('accepte un WebP valide', async () => {
    await expect(service.uploadFile(multerFile(webpBuf()))).resolves.toBeDefined();
  });

  it('accepte un HEIC valide (brand heic)', async () => {
    await expect(service.uploadFile(multerFile(heicBuf('heic')))).resolves.toBeDefined();
  });

  it('accepte un HEIC valide (brand mif1)', async () => {
    await expect(service.uploadFile(multerFile(heicBuf('mif1')))).resolves.toBeDefined();
  });

  it('rejette un MP4 (ftyp brand mp42)', async () => {
    await expect(service.uploadFile(multerFile(mp4Buf()))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejette un buffer trop court (< 12 octets)', async () => {
    const tinyBuf = Buffer.from([0xff, 0xd8, 0xff]);
    await expect(service.uploadFile(multerFile(tinyBuf))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejette un buffer de zéros', async () => {
    await expect(
      service.uploadFile(multerFile(Buffer.alloc(20))),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejette si Cloudinary non configuré', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    }).compile();
    const svcNoCloud = mod.get<UploadService>(UploadService);

    await expect(svcNoCloud.uploadFile(multerFile(jpegBuf()))).rejects.toThrow(
      BadRequestException,
    );
  });
});
