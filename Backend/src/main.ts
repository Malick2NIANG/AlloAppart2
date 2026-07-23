import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ClerkAuthGuard } from './common/guards/clerk-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const config = app.get(ConfigService);
  const prisma = app.get(PrismaService);
  const reflector = app.get(Reflector);

  // CORS — doit être activé AVANT helmet pour ne pas être écrasé
  const isDev = config.get<string>('NODE_ENV') !== 'production';
  app.enableCors({
    origin: isDev
      ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, true)   // dev : tout localhost accepté
      : config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Sécurité — après CORS
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Préfixe global API
  app.setGlobalPrefix('api/v1');

  // Validation automatique des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filtre d'exceptions global
  app.useGlobalFilters(new AllExceptionsFilter());

  // Guards globaux : Auth Clerk + RBAC (roles[])
  app.useGlobalGuards(
    new ClerkAuthGuard(reflector, config, prisma),
    new RolesGuard(reflector),
  );

  // Swagger UI — disponible en dev uniquement
  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Allo-Appart API')
      .setDescription('API REST de la marketplace immobilière Allo-Appart')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'clerk-jwt',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Fail-fast en production si des variables critiques manquent
  if (config.get<string>('NODE_ENV') === 'production') {
    const required = [
      'FRONTEND_URL',
      'BACKEND_URL',
      'DATABASE_URL',
      'CLERK_SECRET_KEY',
      'CLERK_WEBHOOK_SECRET',
      'PAYDUNYA_MASTER_KEY',
      'PAYDUNYA_PRIVATE_KEY',
      'PAYDUNYA_TOKEN',
      'CINETPAY_API_KEY',
      'CINETPAY_SECRET_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    for (const key of required) {
      if (!config.get<string>(key)) {
        throw new Error(
          `Variable d'environnement manquante en production : ${key}`,
        );
      }
    }
  }

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API Allo-Appart démarrée sur le port ${port}`);
  if (config.get<string>('NODE_ENV') !== 'production') {
    logger.log(`Swagger UI : http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
