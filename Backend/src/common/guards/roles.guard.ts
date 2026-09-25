import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type User, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User; clerkSessionId?: string }>();
    const user = request.user;

    // L'utilisateur doit avoir au moins un des rôles requis dans son tableau de rôles
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) throw new ForbiddenException('Access denied');

    // 2FA obligatoire pour le rôle ADMIN — l'espace admin est le plus
    // sensible de la plateforme (config tarifaire, litiges, comptes...).
    // Depuis le 2026-09-25 : code envoyé par email à CHAQUE connexion
    // (remplace le TOTP Clerk, payant) — validité vérifiée par session
    // Clerk (claim "sid"), pas par un flag permanent sur le compte. Ne
    // bloque que les routes explicitement réservées à ADMIN : un compte
    // admin garde l'accès aux routes génériques (ex. /auth/me,
    // /auth/admin-mfa/*) pour pouvoir saisir son code depuis le frontend.
    if (requiredRoles.includes(Role.ADMIN) && user.roles.includes(Role.ADMIN)) {
      const verified = await this.isAdminSessionVerified(
        user.id,
        request.clerkSessionId,
      );
      if (!verified) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'ADMIN_MFA_REQUIRED',
          message:
            'Un code de connexion doit être validé avant d’accéder à l’espace administrateur.',
        });
      }
    }

    return true;
  }

  private async isAdminSessionVerified(
    adminId: string,
    sessionId: string | undefined,
  ): Promise<boolean> {
    if (!sessionId) return false;
    const row = await this.prisma.adminVerifiedSession.findUnique({
      where: { adminId_sessionId: { adminId, sessionId } },
    });
    return !!row && row.expiresAt > new Date();
  }
}
