import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgencesService } from './agences.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, Role, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

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
    booking: { findFirst: jest.Mock };
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
      booking: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgencesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AgencesService>(AgencesService);
  });

  describe('findBySlug — résolution des champs vitrine', () => {
    it('priorise agencyBio/agencyAvatar quand ils sont renseignés, et ne renvoie jamais le téléphone', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...baseAgency,
        bio: 'Bio personnelle',
        avatar: 'perso.jpg',
        agencyBio: 'Bio officielle de l\'agence',
        agencyAvatar: 'logo-agence.jpg',
        listings: [],
      });

      const result = await service.findBySlug('guilla-immo');

      expect(result).toMatchObject({
        bio: 'Bio officielle de l\'agence',
        avatar: 'logo-agence.jpg',
      });
      // Les clés brutes agencyX ne doivent jamais fuiter dans la réponse publique,
      // et le téléphone (Task #120) n'est plus exposé du tout sur cette route.
      expect(result).not.toHaveProperty('agencyBio');
      expect(result).not.toHaveProperty('agencyAvatar');
      expect(result).not.toHaveProperty('phone');
    });

    it("replie sur bio/avatar personnels quand la vitrine n'a pas encore été remplie", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...baseAgency,
        bio: 'Bio personnelle',
        avatar: 'perso.jpg',
        agencyBio: null,
        agencyAvatar: null,
        listings: [],
      });

      const result = await service.findBySlug('guilla-immo');

      expect(result).toMatchObject({
        bio: 'Bio personnelle',
        avatar: 'perso.jpg',
      });
    });

    it("lève NotFoundException si l'agence n'existe pas", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.findBySlug('inconnue')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll — résolution des champs vitrine sur la liste', () => {
    it('applique le même repli sur chaque agence de la liste, sans jamais renvoyer le téléphone', async () => {
      prismaMock.user.findMany.mockResolvedValueOnce([
        {
          ...baseAgency,
          bio: 'Bio personnelle',
          avatar: 'perso.jpg',
          agencyBio: null,
          agencyAvatar: 'logo-agence.jpg',
        },
      ]);

      const result = await service.findAll();

      expect(result[0]).toMatchObject({
        bio: 'Bio personnelle',
        avatar: 'logo-agence.jpg',
      });
      expect(result[0]).not.toHaveProperty('agencyAvatar');
      expect(result[0]).not.toHaveProperty('phone');
    });
  });

  // Task #120 — anti-contournement : le vrai téléphone ne doit être révélé
  // qu'à un visiteur connecté ayant une réservation confirmée/active/terminée
  // avec cette agence précise.
  describe('getPhoneForViewer', () => {
    it("renvoie le téléphone si une réservation qualifiante existe", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'a1',
        phone: '+221770000001',
        agencyPhone: '+221770000002',
        roles: [Role.PRO_AGENCE],
        isSuspended: false,
      });
      prismaMock.booking.findFirst.mockResolvedValueOnce({ id: 'b1' });

      const result = await service.getPhoneForViewer('guilla-immo', 'tenant-1');

      expect(result).toEqual({ phone: '+221770000002' });
      expect(prismaMock.booking.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED] },
          listing: { ownerId: 'a1' },
        },
        select: { id: true },
      });
    });

    it("renvoie phone: null si aucune réservation qualifiante n'existe", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'a1',
        phone: '+221770000001',
        agencyPhone: '+221770000002',
        roles: [Role.PRO_AGENCE],
        isSuspended: false,
      });
      prismaMock.booking.findFirst.mockResolvedValueOnce(null);

      const result = await service.getPhoneForViewer('guilla-immo', 'tenant-1');

      expect(result).toEqual({ phone: null });
    });

    it("lève NotFoundException si l'agence n'existe pas", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.getPhoneForViewer('inconnue', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });
});
