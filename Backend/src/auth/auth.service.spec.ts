// Mocker createClerkClient avant tout import pour éviter les appels réseau au constructeur
jest.mock('@clerk/backend', () => {
  const actual =
    jest.requireActual<typeof import('@clerk/backend')>('@clerk/backend');
  return {
    ...actual,
    createClerkClient: jest.fn(() => ({})),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { Role } from '@prisma/client';
import type { CreateProAgenceDto } from './dto/create-pro-agence.dto';

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
        {
          provide: MailService,
          useValue: {
            sendWelcome: jest.fn(),
            sendPasswordChanged: jest.fn(),
            sendCredentials: jest.fn(),
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

  // --- changePassword ---
  describe('changePassword', () => {
    it('lève ForbiddenException si mustChangePassword est false (pas un changement forcé)', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        mustChangePassword: false,
      });

      await expect(
        service.changePassword('user1', { newPassword: 'NouveauMdp123!' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('change le mot de passe Clerk et repasse mustChangePassword à false quand autorisé', async () => {
      const updateUser = jest.fn().mockResolvedValueOnce(undefined);
      // @ts-expect-error accès à la propriété privée clerkClient pour le mock de test
      service.clerkClient = { users: { updateUser } };

      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        mustChangePassword: true,
      });
      prismaMock.user.update.mockResolvedValueOnce({
        ...baseUser,
        mustChangePassword: false,
      });

      const result = await service.changePassword('user1', {
        newPassword: 'NouveauMdp123!',
      });

      expect(updateUser).toHaveBeenCalledWith('clerk_abc', {
        password: 'NouveauMdp123!',
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { mustChangePassword: false },
      });
      expect(result).toEqual({ success: true });
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

  // --- acceptTerms ---
  describe('acceptTerms', () => {
    it("retourne le user tel quel s'il a déjà accepté les CGU (idempotent)", async () => {
      const accepted = { ...baseUser, termsAcceptedAt: new Date('2026-01-01') };
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(accepted);
      const result = await service.acceptTerms('user1');
      expect(result).toEqual(accepted);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("enregistre la date d'acceptation si jamais accepté", async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        termsAcceptedAt: null,
      });
      prismaMock.user.update.mockResolvedValueOnce({
        ...baseUser,
        termsAcceptedAt: new Date(),
      });
      const result = await service.acceptTerms('user1');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user1' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ termsAcceptedAt: expect.any(Date) }),
        }),
      );
      expect(result.termsAcceptedAt).toBeTruthy();
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
          {
            provide: MailService,
            useValue: {
              sendWelcome: jest.fn(),
              sendPasswordChanged: jest.fn(),
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

  // --- Slug de vitrine auto-généré (jamais saisi/édité par l'agence) ---
  // Régression produit : l'agence ne doit plus jamais voir/choisir de slug —
  // "Ma vitrine" reste une page AlloAppart, pas un nom de domaine à gérer.
  describe('updateMe — assignation automatique du slug agence', () => {
    it("attribue un slug au premier renseignement d'agencyName (agence sans slug)", async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        agencyName: null,
        agencySlug: null,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce(null); // slug candidat libre
      prismaMock.user.update.mockResolvedValueOnce({
        ...baseUser,
        agencyName: 'Guilla Immo',
        agencySlug: 'guilla-immo',
      });

      const result = await service.updateMe('user1', {
        agencyName: 'Guilla Immo',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { agencyName: 'Guilla Immo', agencySlug: 'guilla-immo' },
      });
      expect(result.agencySlug).toBe('guilla-immo');
    });

    it("ajoute un suffixe -2 si le slug de base est déjà pris par une autre agence", async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        agencyName: null,
        agencySlug: null,
      });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 'autre-user' }) // "guilla-immo" déjà pris
        .mockResolvedValueOnce(null); // "guilla-immo-2" libre
      prismaMock.user.update.mockResolvedValueOnce({
        ...baseUser,
        agencyName: 'Guilla Immo',
        agencySlug: 'guilla-immo-2',
      });

      const result = await service.updateMe('user1', {
        agencyName: 'Guilla Immo',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { agencyName: 'Guilla Immo', agencySlug: 'guilla-immo-2' },
      });
      expect(result.agencySlug).toBe('guilla-immo-2');
    });

    it('ne régénère jamais le slug une fois déjà assigné (URL stable)', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseUser,
        agencyName: 'Guilla Immo',
        agencySlug: 'guilla-immo',
      });
      prismaMock.user.update.mockResolvedValueOnce({
        ...baseUser,
        agencyName: 'Guilla Immo SARL',
        agencySlug: 'guilla-immo',
      });

      await service.updateMe('user1', { agencyName: 'Guilla Immo SARL' });

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { agencyName: 'Guilla Immo SARL' },
      });
    });

    it("ne touche pas au slug si agencyName n'est pas fourni dans le DTO", async () => {
      prismaMock.user.update.mockResolvedValueOnce(baseUser);

      await service.updateMe('user1', { bio: 'Nouvelle bio' });

      expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { bio: 'Nouvelle bio' },
      });
    });
  });

  describe('createProAgence — slug assigné dès la création du compte', () => {
    const adminUser = { ...baseUser, id: 'admin1', roles: [Role.ADMIN] };
    const dto: CreateProAgenceDto = {
      email: 'agence@example.com',
      firstName: 'Fatou',
      lastName: 'Ndiaye',
      agencyName: "Immo Dakar Plus",
    };

    it('génère et persiste un agencySlug sans que le DTO ne le contienne', async () => {
      const createUser = jest
        .fn()
        .mockResolvedValueOnce({ id: 'clerk_new_agency' });
      // @ts-expect-error accès à la propriété privée clerkClient pour le mock de test
      service.clerkClient = { users: { createUser } };

      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(adminUser);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null) // email pas déjà pris
        .mockResolvedValueOnce(null); // slug candidat "immo-dakar-plus" libre
      prismaMock.user.create.mockResolvedValueOnce({
        ...baseUser,
        agencyName: dto.agencyName,
        agencySlug: 'immo-dakar-plus',
        roles: [Role.PRO_AGENCE],
      });

      const result = await service.createProAgence('admin1', dto);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agencySlug: 'immo-dakar-plus',
          }),
        }),
      );
      expect(result.agencySlug).toBe('immo-dakar-plus');
    });
  });
});
