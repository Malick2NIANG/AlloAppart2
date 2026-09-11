import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgencesService } from './agences.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

// Régression produit : la vitrine publique (/agences/:slug) et le profil
// personnel (/profil) partageaient auparavant les mêmes colonnes
// bio/avatar/phone — éditer l'un écrasait silencieusement l'autre. Ces
// champs sont désormais distincts (agencyBio/agencyAvatar/agencyPhone),
// avec repli sur les champs perso pour les agences qui n'ont pas encore
// rempli leur vitrine (créées avant cette séparation).
describe('AgencesService', () => {
  let service: AgencesService;
  let prismaMock: {
    user: { findMany: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
  };

  const baseAgency = {
    id: 'a1',
    firstName: 'Rouguiyatou',
    lastName: 'Sy',
    agencyName: 'Guilla Immo',
    agencySlug: 'guilla-immo',
    roles: [Role.PRO_AGENCE],
    isSuspended: false,
    createdAt: new Date(),
    subscription: { plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE },
    _count: { listings: 3 },
  };

  beforeEach(async () => {
    prismaMock = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgencesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AgencesService>(AgencesService);
  });

  describe('findBySlug — résolution des champs vitrine', () => {
    it('priorise agencyBio/agencyAvatar/agencyPhone quand ils sont renseignés', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...baseAgency,
        bio: 'Bio personnelle',
        avatar: 'perso.jpg',
        phone: '+221770000001',
        agencyBio: 'Bio officielle de l\'agence',
        agencyAvatar: 'logo-agence.jpg',
        agencyPhone: '+221770000002',
        listings: [],
      });

      const result = await service.findBySlug('guilla-immo');

      expect(result).toMatchObject({
        bio: 'Bio officielle de l\'agence',
        avatar: 'logo-agence.jpg',
        phone: '+221770000002',
      });
      // Les clés brutes agencyX ne doivent jamais fuiter dans la réponse publique
      expect(result).not.toHaveProperty('agencyBio');
      expect(result).not.toHaveProperty('agencyAvatar');
      expect(result).not.toHaveProperty('agencyPhone');
    });

    it("replie sur bio/avatar/phone personnels quand la vitrine n'a pas encore été remplie", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...baseAgency,
        bio: 'Bio personnelle',
        avatar: 'perso.jpg',
        phone: '+221770000001',
        agencyBio: null,
        agencyAvatar: null,
        agencyPhone: null,
        listings: [],
      });

      const result = await service.findBySlug('guilla-immo');

      expect(result).toMatchObject({
        bio: 'Bio personnelle',
        avatar: 'perso.jpg',
        phone: '+221770000001',
      });
    });

    it("lève NotFoundException si l'agence n'existe pas", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.findBySlug('inconnue')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll — résolution des champs vitrine sur la liste', () => {
    it('applique le même repli sur chaque agence de la liste', async () => {
      prismaMock.user.findMany.mockResolvedValueOnce([
        {
          ...baseAgency,
          bio: 'Bio personnelle',
          avatar: 'perso.jpg',
          phone: '+221770000001',
          agencyBio: null,
          agencyAvatar: 'logo-agence.jpg',
          agencyPhone: null,
        },
      ]);

      const result = await service.findAll();

      expect(result[0]).toMatchObject({
        bio: 'Bio personnelle',
        avatar: 'logo-agence.jpg',
        phone: '+221770000001',
      });
      expect(result[0]).not.toHaveProperty('agencyAvatar');
    });
  });
});
