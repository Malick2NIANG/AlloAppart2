import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Vérification cryptographique complète du JWT (signature + expiration
      // + audience/authorized parties) via le SDK Clerk. L'ancienne version
      // se contentait de décoder le payload en base64 sans jamais vérifier
      // la signature — n'importe qui pouvait forger un token avec un `sub`
      // arbitraire et usurper n'importe quel compte (y compris ADMIN).
      const payload = await verifyToken(token, {
        secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
      });
      const clerkId = payload.sub;

      if (!clerkId) throw new UnauthorizedException('Token sans sub');

      // Cherche l'utilisateur en base
      let user = await this.prisma.user.findUnique({ where: { clerkId } });

      // Création automatique à la première connexion (webhook pas encore reçu)
      if (!user) {
        try {
          user = await this.prisma.user.create({
            data: {
              clerkId,
              email: `${clerkId}@clerk.local`,
              firstName: '',
              lastName: '',
              // roles utilise le @default([LOCATAIRE]) du schema — pas d'enum explicite
            },
          });
        } catch {
          // Peut-être créé en parallèle entre le findUnique et le create
          user = await this.prisma.user.findUnique({ where: { clerkId } });
          if (!user) throw new UnauthorizedException('Failed to create user');
        }
      }

      if (user.isSuspended) throw new UnauthorizedException('Account suspended');

      request.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      process.stderr.write(
        '[Guard] err=' + String((err as Error)?.constructor?.name) +
        ' code=' + String((err as any)?.code) +
        ' msg=' + String((err as Error)?.message) +
        ' meta=' + JSON.stringify((err as any)?.meta) + '\n',
      );
      throw new UnauthorizedException('Invalid token or user not found');
    }
  }
}
