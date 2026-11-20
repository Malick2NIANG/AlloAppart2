import { Test, TestingModule } from '@nestjs/testing';
import { PlatformConfigService } from './platform-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

// getPublicPricing() (lot « page /tarifs », étendu au lot « prix en dur ») :
// sous-ensemble public de getPricing(), boostPriceFcfa inclus depuis le lot
// « prix en dur » (consommé par bailleur/boost, bailleur/listings, publier).
describe('PlatformConfigService — getPublicPricing', () => {
  let service: PlatformConfigService;
  let prismaMock: {
    platformConfig: { findUnique: jest.Mock; create: jest.Mock };
  };

  const row = {
    id: 'singleton',
    starterPriceFcfa: 75000,
    proPriceFcfaMonthly: 150000,
    nightlyCommissionRate: 0.1,
    monthlyCommissionMonths: 1,
    auditBasicPriceFcfa: 25000,
    boostPriceFcfa: 5000,
    pendingStarterPriceFcfa: null,
    pendingProPriceFcfaMonthly: null,
    pendingNightlyCommissionRate: null,
    pendingMonthlyCommissionMonths: null,
    pendingAuditBasicPriceFcfa: null,
    pendingBoostPriceFcfa: null,
    pendingEffectiveAt: null,
  };

  beforeEach(async () => {
    prismaMock = {
      platformConfig: {
        findUnique: jest.fn().mockResolvedValue(row),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformConfigService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get(PlatformConfigService);
  });

  it('renvoie les champs affichés sur /bailleur/abonnement et /tarifs, plus boostPriceFcfa (pages bailleur boost/listings/publier)', async () => {
    const result = await service.getPublicPricing();
    expect(result).toEqual({
      starterPriceFcfa: 75000,
      proPriceFcfaMonthly: 150000,
      nightlyCommissionRate: 0.1,
      monthlyCommissionMonths: 1,
      auditBasicPriceFcfa: 25000,
      boostPriceFcfa: 5000,
    });
  });

  it('reflète un changement de tarif (pas de valeur figée) — même ligne, autre montant', async () => {
    prismaMock.platformConfig.findUnique.mockResolvedValue({
      ...row,
      starterPriceFcfa: 80000,
    });
    const result = await service.getPublicPricing();
    expect(result.starterPriceFcfa).toBe(80000);
  });
});
