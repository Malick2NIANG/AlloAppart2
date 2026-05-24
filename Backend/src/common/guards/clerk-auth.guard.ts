import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly clerkClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.config.get<string>('CLERK_SECRET_KEY') ?? '',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.split(' ')[1];

    try {
      const secretKey = this.config.get<string>('CLERK_SECRET_KEY') ?? '';
      const payload = await verifyToken(token, { secretKey });
      const clerkId = payload.sub;

      // Cherche l'utilisateur en base ; si absent, le crée automatiquement via l'API Clerk
      let user = await this.prisma.user.findUnique({ where: { clerkId } });

      if (!user) {
        const clerkUser = await this.clerkClient.users.getUser(clerkId);
        const primaryEmail = clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        );

        user = await this.prisma.user.upsert({
          where: { clerkId },
          create: {
            clerkId,
            email: primaryEmail?.emailAddress ?? `${clerkId}@noemail.local`,
            firstName: clerkUser.firstName ?? 'Utilisateur',
            lastName: clerkUser.lastName ?? '',
            phone: clerkUser.phoneNumbers?.[0]?.phoneNumber ?? null,
            roles: [Role.LOCATAIRE],
          },
          update: {},
        });
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalide ou utilisateur introuvable');
    }
  }
}
