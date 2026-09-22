import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { type User, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  private clerkClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request.user;

    // L'utilisateur doit avoir au moins un des rôles requis dans son tableau de rôles
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) throw new ForbiddenException('Access denied');

    // 2FA obligatoire pour le rôle ADMIN — l'espace admin est le plus
    // sensible de la plateforme (config tarifaire, litiges, comptes...).
    // Ne bloque que les routes explicitement réservées à ADMIN : un compte
    // admin garde l'accès aux routes génériques (ex. /auth/me,
    // /auth/me PATCH) pour pouvoir activer sa 2FA depuis /profil/securite.
    if (requiredRoles.includes(Role.ADMIN) && user.roles.includes(Role.ADMIN)) {
      const twoFactorOk = await this.ensureAdminTwoFactor(user);
      if (!twoFactorOk) {
        throw new ForbiddenException({
          statusCode: 403,
          code: '2FA_REQUIRED',
          message:
            "L'authentification à deux facteurs (2FA) doit être activée sur ce compte administrateur avant d'accéder à l'espace admin.",
        });
      }
    }

    return true;
  }

  // Vérifie si la 2FA (TOTP) est active sur ce compte ADMIN. Fait confiance
  // au flag local (synchronisé par le webhook Clerk user.updated) quand il
  // est déjà à true — aucun appel réseau dans le cas normal, une fois la 2FA
  // activée. Quand il est à false, revérifie en direct auprès de Clerk (source
  // de vérité) avant de bloquer, au cas où le webhook n'aurait pas encore
  // tourné (ou pas configuré en dev) — et auto-corrige le flag local si Clerk
  // dit que c'est bien actif.
  private async ensureAdminTwoFactor(user: User): Promise<boolean> {
    if (user.twoFactorEnabled) return true;

    try {
      const clerkUser = await this.clerkClient.users.getUser(user.clerkId);
      if (clerkUser.twoFactorEnabled) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { twoFactorEnabled: true },
        });
        return true;
      }
    } catch {
      // Clerk injoignable — on retombe sur l'état local connu (false)
    }

    return false;
  }
}
