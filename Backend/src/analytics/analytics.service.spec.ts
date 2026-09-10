import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

// Ces tests couvrent uniquement la nouvelle logique de restriction PRO des
// analytics avancées (getVitrineStats) et du rapport PDF mensuel
// (getOwnerMonthlyReport) — pas l'ensemble du service, déjà non testé avant
// ce lot.
describe('AnalyticsService — restriction plan PRO', () => {
  let service: AnalyticsService;
  let prismaMock: {
    user: { findUniqueOrThrow: jest.Mock };
    listing: { findMany: jest.Mock; count: jest.Mock };
    review: { aggregate: jest.Mock };
    booking: { count: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock };
  };

  const proAgenceUser = (plan: SubscriptionPlan | null, status: SubscriptionStatus | null) => ({
    profileViews: 42,
    agencyName: 'Guilla Immo',
    agencySlug: 'guilla-immo',
    roles: [Role.PRO_AGENCE],
    firstName: 'Rouguiyatou',
    lastName: 'Sy',
    subscription: plan ? { plan, status } : null,
  });

  beforeEach(async () => {
    prismaMock = {
      user: { findUniqueOrThrow: jest.fn() },
      listing: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      review: { aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null }, _count: { id: 0 } }) },
      booking: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getVitrineStats', () => {
    it('STARTER : isPro=false et les sections avancées sont vidées (jamais renvoyées au client)', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(
        proAgenceUser(SubscriptionPlan.STARTER, SubscriptionStatus.ACTIVE),
      );
      prismaMock.listing.findMany.mockResolvedValueOnce([
        {
          id: 'l1', title: 'Appt 1', city: 'Dakar', type: 'APPARTEMENT', status: 'ACTIVE', isVerified: true,
          _count: { bookings: 3, reviews: 1, favoritedBy: 0 },
          bookings: [{ totalAmount: 100000 }],
        },
      ]);

      const result = await service.getVitrineStats('owner1');

      expect(result.isPro).toBe(false);
      expect(result.topListings).toEqual([]);
      expect(result.monthly).toEqual([]);
      expect(result.conversionRate).toBeNull();
      expect(result.alloVerifieRate).toBeNull();
      expect(result.performanceScore).toBeNull();
      expect(result.verifiedActiveCount).toBeNull();
      expect(result.totalActiveCount).toBeNull();
      // Les KPIs de base restent visibles même en STARTER (aperçu de valeur).
      expect(result.totalListings).toBe(1);
      expect(result.totalRevenue).toBe(100000);
    });

    it('PRO actif : isPro=true et toutes les sections avancées sont calculées', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(
        proAgenceUser(SubscriptionPlan.PRO, SubscriptionStatus.ACTIVE),
      );
      prismaMock.listing.findMany.mockResolvedValueOnce([
        {
          id: 'l1', title: 'Appt 1', city: 'Dakar', type: 'APPARTEMENT', status: 'ACTIVE', isVerified: true,
          _count: { bookings: 3, reviews: 1, favoritedBy: 0 },
          bookings: [{ totalAmount: 100000 }],
        },
      ]);

      const result = await service.getVitrineStats('owner1');

      expect(result.isPro).toBe(true);
      expect(result.topListings).toHaveLength(1);
      expect(result.monthly).toHaveLength(6);
      expect(result.conversionRate).not.toBeNull();
      expect(result.performanceScore).not.toBeNull();
      expect(result.totalActiveCount).toBe(1);
    });

    it('STARTER avec abonnement SUSPENDED (expiré) : toujours isPro=false', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(
        proAgenceUser(SubscriptionPlan.PRO, SubscriptionStatus.SUSPENDED),
      );

      const result = await service.getVitrineStats('owner1');

      expect(result.isPro).toBe(false);
      expect(result.monthly).toEqual([]);
    });
  });

  describe('getOwnerMonthlyReport — rapport PDF réservé au plan PRO', () => {
    it('rejette un compte PRO_AGENCE sans abonnement PRO actif, avec un code structuré', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue(
        proAgenceUser(SubscriptionPlan.STARTER, SubscriptionStatus.ACTIVE),
      );

      await expect(
        service.getOwnerMonthlyReport('owner1', '2026-08'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getOwnerMonthlyReport('owner1', '2026-08'),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PRO_ONLY' }) });
    });

    it('rejette un compte PRO_AGENCE sans aucun abonnement (jamais souscrit)', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(proAgenceUser(null, null));

      await expect(
        service.getOwnerMonthlyReport('owner1', '2026-08'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorise un compte PRO_AGENCE avec abonnement PRO actif', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(
        proAgenceUser(SubscriptionPlan.PRO, SubscriptionStatus.ACTIVE),
      );

      await expect(
        service.getOwnerMonthlyReport('owner1', '2026-08'),
      ).resolves.toBeDefined();
    });

    it("autorise un simple BAILLEUR individuel sans abonnement (fonctionnalité hors périmètre agence)", async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        firstName: 'Awa', lastName: 'Ndiaye', agencyName: null,
        roles: [Role.BAILLEUR], subscription: null,
      });

      await expect(
        service.getOwnerMonthlyReport('owner2', '2026-08'),
      ).resolves.toBeDefined();
    });
  });
});
