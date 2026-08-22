import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

// verifyToken est mocké : c'est justement la fonction dont l'absence
// constituait la faille (décodage local du JWT sans vérification de
// signature). On simule ici son comportement réel — rejet si la signature
// est invalide, résolution avec le payload si le token est authentique.
const verifyTokenMock = jest.fn();
jest.mock('@clerk/backend', () => ({
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
}));

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let prismaMock: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let reflector: Reflector;

  const makeContext = (authorization?: string): ExecutionContext => {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: authorization ? { authorization } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    verifyTokenMock.mockReset();
    prismaMock = {
      user: { findUnique: jest.fn(), create: jest.fn() },
    };
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false); // route non publique par défaut

    const config = { get: jest.fn().mockReturnValue('sk_test_clerk') } as unknown as ConfigService;
    guard = new ClerkAuthGuard(reflector, config, prismaMock as unknown as PrismaService);
  });

  it("rejette un token dont la signature est invalide (forgé) — la faille corrigée", async () => {
    verifyTokenMock.mockRejectedValueOnce(new Error('JWT signature is invalid.'));

    const ctx = makeContext('Bearer eyJforged.payload.sig');

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('accepte un token dont la signature est valide et charge l\'utilisateur correspondant', async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: 'clerk_123' });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user1',
      clerkId: 'clerk_123',
      isSuspended: false,
      roles: ['LOCATAIRE'],
    });

    const ctx = makeContext('Bearer eyJvalid.payload.sig');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifyTokenMock).toHaveBeenCalledWith(
      'eyJvalid.payload.sig',
      expect.objectContaining({ secretKey: 'sk_test_clerk' }),
    );
  });

  it('refuse un compte suspendu même avec un token valide', async () => {
    verifyTokenMock.mockResolvedValueOnce({ sub: 'clerk_123' });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user1',
      clerkId: 'clerk_123',
      isSuspended: true,
      roles: ['LOCATAIRE'],
    });

    const ctx = makeContext('Bearer eyJvalid.payload.sig');

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejette une requête sans header Authorization', async () => {
    const ctx = makeContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('laisse passer une route @Public() sans vérifier de token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = makeContext(undefined);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });
});
