import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationsService, AUDIT_PRICE_XOF } from './verifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { Role, VerifStatus, SubscriptionPlan, SubscriptionStatus, type User } from '@prisma/client';

// Ce fichier couvre create() (gratuité PRO/admin vs paiement PayDunya
// obligatoire pour les autres), reject() et findRatingByVerification() — les
// correctifs de sécurité appliqués à ce module. Les autres méthodes (assign,
// decline, complete, validate, rate) ne sont pas encore couvertes ici.
describe('VerificationsService', () => {
  let service: VerificationsService;
  let prismaMock: {
    verification: {
      findUniqueOrThrow: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    verificationPayment: {
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    agentRating: { findUnique: jest.Mock };
    listing: { findUnique: jest.Mock; updateMany: jest.Mock };
    user: { findUniqueOrThrow: jest.Mock };
  };
  let configMock: { get: jest.Mock };
  let softpayMock: { confirmInvoiceStatus: jest.Mock; verifyAndParseCallback: jest.Mock };

  const baseVerification = {
    id: 'verif1',
    listingId: 'listing1',
    agentId: 'agent1',
    status: VerifStatus.IN_PROGRESS,
  };

  beforeEach(async () => {
    prismaMock = {
      verification: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      verificationPayment: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      agentRating: { findUnique: jest.fn() },
      listing: { findUnique: jest.fn(), updateMany: jest.fn() },
      user: { findUniqueOrThrow: jest.fn() },
    };
    configMock = { get: jest.fn() };
    softpayMock = { confirmInvoiceStatus: jest.fn(), verifyAndParseCallback: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: {} },
        { provide: ConfigService, useValue: configMock },
        { provide: PaydunyaSoftpayService, useValue: softpayMock },
      ],
    }).compile();

    service = module.get<VerificationsService>(VerificationsService);
  });

  // Confirmation utilisateur 2026-09-10 : "PRO gratuit, reste payant 25k/60k"
  // — même logique que le boost (cf. listings.service.spec.ts).
  describe('create', () => {
    const dto = {
      listingId: 'listing1',
      auditType: 'BASIC' as const,
      scheduledAt: '2026-12-01T10:00:00.000Z',
    };
    const listing = { id: 'listing1', ownerId: 'owner1' };

    it("refuse si l'appelant n'est ni le propriétaire ni un admin", async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'stranger',
        roles: [Role.BAILLEUR],
        subscription: null,
      });

      await expect(service.create('stranger', dto)).rejects.toThrow(ForbiddenException);
      expect(prismaMock.verification.create).not.toHaveBeenCalled();
    });

    it('crée la Verification gratuitement pour un admin, sans passer par le paiement', async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'admin1',
        roles: [Role.ADMIN],
        subscription: null,
      });
      prismaMock.verification.findFirst.mockResolvedValueOnce(null);
      prismaMock.verification.create.mockResolvedValueOnce({ id: 'v1', ...dto });

      const result = await service.create('admin1', dto);

      expect(result).toMatchObject({ id: 'v1' });
      expect(prismaMock.verificationPayment.findFirst).not.toHaveBeenCalled();
    });

    it('crée la Verification gratuitement pour un abonnement PRO actif', async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: { plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE },
      });
      prismaMock.verification.findFirst.mockResolvedValueOnce(null);
      prismaMock.verification.create.mockResolvedValueOnce({ id: 'v1', ...dto });

      const result = await service.create('owner1', dto);

      expect(result).toMatchObject({ id: 'v1' });
      expect(prismaMock.verificationPayment.findFirst).not.toHaveBeenCalled();
    });

    it('exige un paiement PayDunya pour un plan STARTER (pas de gratuité)', async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: { plan: SubscriptionPlan.STARTER, status: SubscriptionStatus.ACTIVE },
      });
      prismaMock.verification.findFirst.mockResolvedValueOnce(null);
      prismaMock.verificationPayment.findFirst.mockResolvedValueOnce(null);
      configMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'PAYDUNYA_DEV_BYPASS') return 'true';
        return undefined;
      });
      prismaMock.verificationPayment.create.mockResolvedValueOnce({
        id: 'vp1',
        listingId: 'listing1',
        auditType: 'BASIC',
        scheduledAt: new Date(dto.scheduledAt),
        preferredAgentId: null,
        verificationId: null,
      });
      prismaMock.verificationPayment.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'vp1',
        listingId: 'listing1',
        auditType: 'BASIC',
        scheduledAt: new Date(dto.scheduledAt),
        preferredAgentId: null,
        verificationId: null,
      });
      prismaMock.verification.create.mockResolvedValueOnce({ id: 'v1', ...dto });
      prismaMock.verificationPayment.update.mockResolvedValueOnce({});

      const result = await service.create('owner1', dto);

      expect(prismaMock.verificationPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: AUDIT_PRICE_XOF.BASIC, status: 'CONFIRMED' }),
        }),
      );
      expect(result).toMatchObject({ verification: { id: 'v1' } });
    });

    it('exige un paiement PayDunya pour un bailleur individuel sans abonnement', async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });
      prismaMock.verification.findFirst.mockResolvedValueOnce(null);
      prismaMock.verificationPayment.findFirst.mockResolvedValueOnce(null);
      configMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'PAYDUNYA_DEV_BYPASS') return 'true';
        return undefined;
      });
      prismaMock.verificationPayment.create.mockResolvedValueOnce({
        id: 'vp2',
        listingId: 'listing1',
        auditType: 'BASIC',
        scheduledAt: new Date(dto.scheduledAt),
        preferredAgentId: null,
        verificationId: null,
      });
      prismaMock.verificationPayment.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'vp2',
        listingId: 'listing1',
        auditType: 'BASIC',
        scheduledAt: new Date(dto.scheduledAt),
        preferredAgentId: null,
        verificationId: null,
      });
      prismaMock.verification.create.mockResolvedValueOnce({ id: 'v2', ...dto });
      prismaMock.verificationPayment.update.mockResolvedValueOnce({});

      const result = await service.create('owner1', dto);

      expect(result).toMatchObject({ verification: { id: 'v2' } });
    });

    it('refuse un second paiement si un paiement AlloVérifié est déjà en attente pour cette annonce', async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });
      prismaMock.verification.findFirst.mockResolvedValueOnce(null);
      prismaMock.verificationPayment.findFirst.mockResolvedValueOnce({ id: 'vp-pending', status: 'PENDING' });

      await expect(service.create('owner1', dto)).rejects.toThrow(ConflictException);
      expect(prismaMock.verificationPayment.create).not.toHaveBeenCalled();
    });

    it('refuse si une vérification est déjà en cours pour cette annonce', async () => {
      prismaMock.listing.findUnique.mockResolvedValueOnce(listing);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: { plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE },
      });
      prismaMock.verification.findFirst.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create('owner1', dto)).rejects.toThrow(ConflictException);
      expect(prismaMock.verification.create).not.toHaveBeenCalled();
    });
  });

  // Régression : reject() n'avait aucune contrainte de statut, contrairement
  // à decline() — un agent assigné pouvait rejeter (et écraser les notes
  // d'une) vérification déjà DONE, y compris après notation par le bailleur.
  // Comme pour handleBoostWebhookPayDunya (listings.service.spec.ts) : le
  // webhook ne doit jamais faire confiance au statut du payload IPN entrant.
  describe('handleWebhookPayDunya', () => {
    it('ignore si aucun VerificationPayment PENDING trouvé (déjà traité ou inconnu)', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'listing1' },
      });
      prismaMock.verificationPayment.findFirst.mockResolvedValueOnce(null);

      const result = await service.handleWebhookPayDunya({});

      expect(result).toEqual({ ok: true });
      expect(softpayMock.confirmInvoiceStatus).not.toHaveBeenCalled();
    });

    it('crée la Verification seulement après confirmInvoiceStatus — jamais depuis le payload', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'listing1' },
      });
      prismaMock.verificationPayment.findFirst.mockResolvedValueOnce({
        id: 'vp1',
        listingId: 'listing1',
        status: 'PENDING',
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 25000,
        customData: {},
      });
      prismaMock.verificationPayment.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'vp1',
        listingId: 'listing1',
        auditType: 'BASIC',
        scheduledAt: new Date(),
        preferredAgentId: null,
        verificationId: null,
      });
      prismaMock.verification.create.mockResolvedValueOnce({ id: 'v1' });

      await service.handleWebhookPayDunya({ data: { status: 'completed' } });

      expect(softpayMock.confirmInvoiceStatus).toHaveBeenCalledWith('tok1');
      expect(prismaMock.verificationPayment.update).toHaveBeenCalledWith({
        where: { id: 'vp1' },
        data: { status: 'CONFIRMED', paymentRef: 'PD-tok1' },
      });
      expect(prismaMock.verification.create).toHaveBeenCalled();
    });

    it("marque le VerificationPayment FAILED si PayDunya confirme 'failed'", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'listing1' },
      });
      prismaMock.verificationPayment.findFirst.mockResolvedValueOnce({
        id: 'vp1',
        listingId: 'listing1',
        status: 'PENDING',
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'failed',
        totalAmount: 0,
        customData: {},
      });

      await service.handleWebhookPayDunya({});

      expect(prismaMock.verificationPayment.update).toHaveBeenCalledWith({
        where: { id: 'vp1' },
        data: { status: 'FAILED' },
      });
      expect(prismaMock.verification.create).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    const agent = { id: 'agent1', roles: [Role.AGENT_TERRAIN] } as User;
    const admin = { id: 'admin1', roles: [Role.ADMIN] } as User;
    const otherAgent = { id: 'agent2', roles: [Role.AGENT_TERRAIN] } as User;

    it('refuse de rejeter une vérification déjà DONE — le contournement corrigé', async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.DONE,
      });

      await expect(service.reject('verif1', agent, 'changement d\'avis')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.verification.update).not.toHaveBeenCalled();
    });

    it("autorise le rejet pendant IN_PROGRESS par l'agent assigné", async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.IN_PROGRESS,
      });
      prismaMock.verification.update.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.REJECTED,
      });

      await expect(service.reject('verif1', agent, 'accès impossible')).resolves.toBeDefined();
    });

    it("refuse si l'appelant n'est ni l'agent assigné ni un admin", async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.IN_PROGRESS,
      });

      await expect(service.reject('verif1', otherAgent, 'raison')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('un admin ne peut pas non plus rejeter une vérification DONE', async () => {
      prismaMock.verification.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseVerification,
        status: VerifStatus.DONE,
      });

      await expect(service.reject('verif1', admin, 'raison')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // Régression IDOR : GET :id/rating n'avait aucune vérification
  // d'autorisation — n'importe quel utilisateur connecté pouvait lire la
  // note/commentaire laissé par un bailleur sur un agent.
  describe('findRatingByVerification', () => {
    const owner = { id: 'owner1', roles: [Role.BAILLEUR] } as User;
    const ratedAgent = { id: 'agent1', roles: [Role.AGENT_TERRAIN] } as User;
    const admin = { id: 'admin1', roles: [Role.ADMIN] } as User;
    const stranger = { id: 'stranger1', roles: [Role.LOCATAIRE] } as User;

    const verifWithOwner = {
      id: 'verif1',
      agentId: 'agent1',
      listing: { ownerId: 'owner1' },
    };

    it('autorise le bailleur qui a demandé la vérification', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);
      prismaMock.agentRating.findUnique.mockResolvedValueOnce({ rating: 5 });

      await expect(service.findRatingByVerification('verif1', owner)).resolves.toEqual({
        rating: 5,
      });
    });

    it("autorise l'agent noté à voir sa propre note", async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);
      prismaMock.agentRating.findUnique.mockResolvedValueOnce({ rating: 5 });

      await expect(service.findRatingByVerification('verif1', ratedAgent)).resolves.toBeDefined();
    });

    it('autorise un admin', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);
      prismaMock.agentRating.findUnique.mockResolvedValueOnce({ rating: 5 });

      await expect(service.findRatingByVerification('verif1', admin)).resolves.toBeDefined();
    });

    it('refuse à un utilisateur sans lien avec cette vérification — la faille IDOR corrigée', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(verifWithOwner);

      await expect(service.findRatingByVerification('verif1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.agentRating.findUnique).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la vérification n\'existe pas', async () => {
      prismaMock.verification.findUnique.mockResolvedValueOnce(null);

      await expect(service.findRatingByVerification('inconnu', owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Cron d'expiration du badge AlloVérifié — Article 6 des CGU (6 mois)
  describe('expireOldBadges', () => {
    it('retire le badge des annonces vérifiées il y a plus de 6 mois', async () => {
      prismaMock.listing.updateMany.mockResolvedValueOnce({ count: 3 });

      await service.expireOldBadges();

      expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
        where: { isVerified: true, verifiedAt: { lt: expect.any(Date) } },
        data: { isVerified: false },
      });
    });

    it("ne fait rien de plus si aucune annonce n'est concernée", async () => {
      prismaMock.listing.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.expireOldBadges()).resolves.toBeUndefined();
    });
  });
});
