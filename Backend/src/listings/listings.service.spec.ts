import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { ListingsService } from './listings.service';
import {
  ListingStatus,
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  type User,
} from '@prisma/client';

describe('ListingsService', () => {
  let service: ListingsService;
  let prismaMock: {
    user: { findUniqueOrThrow: jest.Mock };
    listing: {
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    boostPayment: { findFirst: jest.Mock; update: jest.Mock };
  };
  let searchMock: {
    indexListing: jest.Mock;
    deleteListingFromIndex: jest.Mock;
  };
  let softpayMock: {
    confirmInvoiceStatus: jest.Mock;
    verifyAndParseCallback: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      user: { findUniqueOrThrow: jest.fn() },
      listing: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      boostPayment: { findFirst: jest.fn(), update: jest.fn() },
    };
    searchMock = {
      indexListing: jest.fn().mockResolvedValue(undefined),
      deleteListingFromIndex: jest.fn().mockResolvedValue(undefined),
    };
    softpayMock = {
      confirmInvoiceStatus: jest.fn(),
      verifyAndParseCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SearchService, useValue: searchMock },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: NotificationsService, useValue: {} },
        { provide: PaydunyaSoftpayService, useValue: softpayMock },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  // Régression : create(), publishListing() et update() menaient tous les
  // trois à un statut ACTIVE, mais seul create() vérifiait l'abonnement
  // PRO_AGENCE — un bailleur pouvait créer une annonce en DRAFT (autorisé
  // sans abonnement) puis la publier via publishListing() ou update(), qui
  // ne vérifiaient rien. Ces tests couvrent les trois chemins.
  describe('abonnement PRO_AGENCE requis pour publier (create/publishListing/update)', () => {
    const proAgenceOwner = { id: 'owner1', roles: [Role.PRO_AGENCE] };

    describe('create', () => {
      it('rejette la création directement ACTIVE si abonnement inactif', async () => {
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          ...proAgenceOwner,
          subscription: {
            status: SubscriptionStatus.CANCELLED,
            plan: SubscriptionPlan.PRO,
          },
        });

        await expect(
          service.create('owner1', { status: ListingStatus.ACTIVE } as never),
        ).rejects.toThrow(ForbiddenException);
        expect(prismaMock.listing.create).not.toHaveBeenCalled();
      });

      it('rejette si plan STARTER déjà au plafond', async () => {
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          ...proAgenceOwner,
          subscription: {
            status: SubscriptionStatus.ACTIVE,
            plan: SubscriptionPlan.STARTER,
          },
        });
        prismaMock.listing.count.mockResolvedValueOnce(10);

        await expect(
          service.create('owner1', { status: ListingStatus.ACTIVE } as never),
        ).rejects.toThrow(BadRequestException);
        expect(prismaMock.listing.create).not.toHaveBeenCalled();
      });

      it("autorise la création en DRAFT sans jamais vérifier l'abonnement", async () => {
        prismaMock.listing.create.mockResolvedValueOnce({
          id: 'l1',
          status: ListingStatus.DRAFT,
        });

        await service.create('owner1', {
          status: ListingStatus.DRAFT,
        } as never);

        expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
        expect(prismaMock.listing.create).toHaveBeenCalled();
      });

      it('un BAILLEUR individuel (non PRO_AGENCE) publie sans abonnement', async () => {
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          id: 'owner1',
          roles: [Role.BAILLEUR],
          subscription: null,
        });
        prismaMock.listing.create.mockResolvedValueOnce({
          id: 'l1',
          status: ListingStatus.ACTIVE,
        });

        await expect(
          service.create('owner1', { status: ListingStatus.ACTIVE } as never),
        ).resolves.toBeDefined();
      });
    });

    describe('publishListing', () => {
      it("refuse de publier un brouillon si l'abonnement n'est plus actif — le contournement corrigé", async () => {
        prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
          id: 'l1',
          ownerId: 'owner1',
          status: ListingStatus.DRAFT,
        });
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          ...proAgenceOwner,
          subscription: {
            status: SubscriptionStatus.CANCELLED,
            plan: SubscriptionPlan.PRO,
          },
        });

        await expect(service.publishListing('l1', 'owner1')).rejects.toThrow(
          ForbiddenException,
        );
        expect(prismaMock.listing.update).not.toHaveBeenCalled();
      });

      it('publie si abonnement actif et sous le plafond', async () => {
        prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
          id: 'l1',
          ownerId: 'owner1',
          status: ListingStatus.DRAFT,
        });
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          ...proAgenceOwner,
          subscription: {
            status: SubscriptionStatus.ACTIVE,
            plan: SubscriptionPlan.PRO,
          },
        });
        prismaMock.listing.update.mockResolvedValueOnce({
          id: 'l1',
          status: ListingStatus.ACTIVE,
        });

        await expect(
          service.publishListing('l1', 'owner1'),
        ).resolves.toBeDefined();
        expect(prismaMock.listing.update).toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('refuse de faire passer une annonce DRAFT → ACTIVE via update() sans abonnement actif', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValueOnce({
          id: 'l1',
          ownerId: 'owner1',
          status: ListingStatus.DRAFT,
        } as never);
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          ...proAgenceOwner,
          subscription: null,
        });

        await expect(
          service.update(
            'l1',
            { id: 'owner1', roles: [Role.PRO_AGENCE] } as User,
            {
              status: ListingStatus.ACTIVE,
            } as never,
          ),
        ).rejects.toThrow(ForbiddenException);
        expect(prismaMock.listing.update).not.toHaveBeenCalled();
      });

      it("n'appelle pas la vérification d'abonnement pour une modification qui ne touche pas au statut", async () => {
        jest.spyOn(service, 'findOne').mockResolvedValueOnce({
          id: 'l1',
          ownerId: 'owner1',
          status: ListingStatus.ACTIVE,
        } as never);
        prismaMock.listing.update.mockResolvedValueOnce({
          id: 'l1',
          status: ListingStatus.ACTIVE,
        });

        await service.update('l1', { id: 'owner1', roles: [Role.PRO_AGENCE] } as User, {
          title: 'Nouveau titre',
        } as never);

        expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
      });
    });
  });

  // Régression : indexListing() fait un upsert Meilisearch inconditionnel
  // (aucun champ status dans le document indexé). archiveListing() et
  // unpublishListing() appelaient indexListing() après être passés en
  // SUSPENDED/DRAFT — l'annonce restait donc trouvable dans la recherche
  // publique malgré l'intention explicite du propriétaire de la masquer.
  describe('synchronisation index de recherche (syncSearchIndex)', () => {
    it('retire une annonce archivée de la recherche au lieu de la ré-indexer — le contournement corrigé', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.DRAFT,
      });
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.SUSPENDED,
      });

      await service.archiveListing('l1', 'owner1');

      expect(searchMock.deleteListingFromIndex).toHaveBeenCalledWith('l1');
      expect(searchMock.indexListing).not.toHaveBeenCalled();
    });

    it('retire une annonce dépubliée de la recherche au lieu de la ré-indexer — le contournement corrigé', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.ACTIVE,
      });
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.DRAFT,
      });

      await service.unpublishListing('l1', 'owner1');

      expect(searchMock.deleteListingFromIndex).toHaveBeenCalledWith('l1');
      expect(searchMock.indexListing).not.toHaveBeenCalled();
    });

    it('indexe une annonce publiée (ACTIVE)', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.DRAFT,
      });
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.ACTIVE,
      });

      await service.publishListing('l1', 'owner1');

      expect(searchMock.indexListing).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'l1', status: ListingStatus.ACTIVE }),
      );
      expect(searchMock.deleteListingFromIndex).not.toHaveBeenCalled();
    });

    it("n'indexe pas une création en DRAFT", async () => {
      prismaMock.listing.create.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.DRAFT,
      });

      await service.create('owner1', { status: ListingStatus.DRAFT } as never);

      expect(searchMock.indexListing).not.toHaveBeenCalled();
      expect(searchMock.deleteListingFromIndex).toHaveBeenCalledWith('l1');
    });
  });

  // Régression : le webhook boost faisait auparavant confiance au statut du
  // payload IPN entrant. Il doit systématiquement revérifier via
  // confirmInvoiceStatus, jamais depuis le payload du webhook.
  describe('handleBoostWebhookPayDunya', () => {
    it('propage le rejet si verifyAndParseCallback échoue (hash invalide)', async () => {
      softpayMock.verifyAndParseCallback.mockImplementation(() => {
        throw new BadRequestException('Invalid callback signature');
      });

      await expect(service.handleBoostWebhookPayDunya({})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.boostPayment.findFirst).not.toHaveBeenCalled();
    });

    it('ignore silencieusement si aucun listing_id dans custom_data', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: {},
      });

      const result = await service.handleBoostWebhookPayDunya({});

      expect(result).toEqual({ ok: true });
      expect(prismaMock.boostPayment.findFirst).not.toHaveBeenCalled();
    });

    it('ignore si aucun BoostPayment PENDING trouvé (déjà traité ou inconnu)', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'l1' },
      });
      prismaMock.boostPayment.findFirst.mockResolvedValueOnce(null);

      const result = await service.handleBoostWebhookPayDunya({});

      expect(result).toEqual({ ok: true });
      expect(softpayMock.confirmInvoiceStatus).not.toHaveBeenCalled();
    });

    it('ne fait JAMAIS confiance au statut du payload — applique le boost seulement après confirmInvoiceStatus', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'l1' },
      });
      prismaMock.boostPayment.findFirst.mockResolvedValueOnce({
        id: 'bp1',
        listingId: 'l1',
        status: 'PENDING',
      });
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        boostScore: 0,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 5000,
        customData: {},
      });

      await service.handleBoostWebhookPayDunya({
        data: { status: 'completed' /* ignoré */ },
      });

      expect(softpayMock.confirmInvoiceStatus).toHaveBeenCalledWith('tok1');
      expect(prismaMock.boostPayment.update).toHaveBeenCalledWith({
        where: { id: 'bp1' },
        data: { status: 'CONFIRMED', paymentRef: 'PD-tok1' },
      });
      expect(prismaMock.listing.update).toHaveBeenCalled();
    });

    it("marque le BoostPayment FAILED si PayDunya confirme 'failed'", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'l1' },
      });
      prismaMock.boostPayment.findFirst.mockResolvedValueOnce({
        id: 'bp1',
        listingId: 'l1',
        status: 'PENDING',
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'failed',
        totalAmount: 0,
        customData: {},
      });

      await service.handleBoostWebhookPayDunya({});

      expect(prismaMock.boostPayment.update).toHaveBeenCalledWith({
        where: { id: 'bp1' },
        data: { status: 'FAILED' },
      });
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });
  });
});
