// Mocker createClerkClient avant tout import pour éviter les appels réseau au constructeur
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual<typeof import('@clerk/backend')>('@clerk/backend');
  return {
    ...actual,
    createClerkClient: jest.fn(() => ({})),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

const baseUser = {
  id: 'user1',
  clerkId: 'clerk_abc',
  email: 'test@example.com',
  firstName: 'Malick',
  lastName: 'Niang',
  phone: '+221770000000',
  roles: [Role.LOCATAIRE],
  isVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'CLERK_SECRET_KEY') return 'sk_test_clerk';
              if (key === 'CLERK_WEBHOOK_SECRET') return 'whsec_test';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // --- syncUser ---
  describe('syncUser', () => {
    it('retourne le user existant sans créer de doublon (idempotent)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(baseUser);
      const result = await service.syncUser({
        clerkId: 'clerk_abc',
        email: 'test@example.com',
        firstName: 'Malick',
        lastName: 'Niang',
      });
      expect(result).toEqual(baseUser);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('crée le user si inexistant', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce(baseUser);

      const result = await service.syncUser({
        clerkId: 'clerk_new',
        email: 'nouveau@example.com',
        firstName: 'Boubacar',
        lastName: 'Diallo',
      });
      expect(prismaMock.user.create).toHaveBeenCalled();
      expect(result.roles).toContain(Role.LOCATAIRE);
    });

    it('lève ConflictException si email déjà pris par un autre user', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...baseUser, clerkId: 'another_clerk' });

      await expect(
        service.syncUser({
          clerkId: 'clerk_xyz',
          email: 'test@example.com',
          firstName: 'Autre',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // --- activateBailleur ---
  describe('activateBailleur', () => {
    it("retourne le user tel quel s'il est déjà BAILLEUR (idempotent)", async () => {
      const bailleur = { ...baseUser, roles: [Role.LOCATAIRE, Role.BAILLEUR] };
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(bailleur);
      const result = await service.activateBailleur('user1');
      expect(result).toEqual(bailleur);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si le user n'a pas de téléphone", async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        phone: null,
      });
      await expect(service.activateBailleur('user1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('active le rôle BAILLEUR si téléphone présent et pas encore BAILLEUR', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(baseUser);
      prismaMock.user.update.mockResolvedValueOnce({
        ...baseUser,
        roles: [Role.LOCATAIRE, Role.BAILLEUR],
      });
      const result = await service.activateBailleur('user1');
      expect(prismaMock.user.update).toHaveBeenCalled();
      expect(result.roles).toContain(Role.BAILLEUR);
    });
  });

  // --- handleWebhook ---
  describe('handleWebhook — fail-closed', () => {
    it('lève UnauthorizedException si CLERK_WEBHOOK_SECRET absent', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: prismaMock },
          {
            provide: ConfigService,
            useValue: {
              // CLERK_SECRET_KEY fourni pour que createClerkClient ne plante pas
              get: (key: string) =>
                key === 'CLERK_SECRET_KEY' ? 'sk_test_clerk' : undefined,
            },
          },
        ],
      }).compile();
      const svc = mod.get<AuthService>(AuthService);

      await expect(
        svc.handleWebhook(Buffer.from('body'), {
          'svix-id': 'id',
          'svix-timestamp': '123',
          'svix-signature': 'sig',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
