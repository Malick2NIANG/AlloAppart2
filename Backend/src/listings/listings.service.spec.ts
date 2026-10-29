import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
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
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    boostPayment: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let searchMock: {
    indexListing: jest.Mock;
    deleteListingFromIndex: jest.Mock;
  };
  let softpayMock: {
    confirmInvoiceStatus: jest.Mock;
    verifyAndParseCallback: jest.Mock;
  };
  let configMock: { get: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      user: { findUniqueOrThrow: jest.fn() },
      listing: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      boostPayment: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    searchMock = {
      indexListing: jest.fn().mockResolvedValue(undefined),
      deleteListingFromIndex: jest.fn().mockResolvedValue(undefined),
    };
    softpayMock = {
      confirmInvoiceStatus: jest.fn(),
      verifyAndParseCallback: jest.fn(),
    };
    configMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SearchService, useValue: searchMock },
        { provide: ConfigService, useValue: configMock },
        { provide: NotificationsService, useValue: {} },
        { provide: PaydunyaSoftpayService, useValue: softpayMock },
        {
          provide: PlatformConfigService,
          useValue: {
            getPricing: jest.fn().mockResolvedValue({
              starterPriceFcfa: 75_000,
              proPriceFcfaMonthly: 150_000,
              nightlyCommissionRate: 0.1,
              monthlyCommissionMonths: 1,
              auditBasicPriceFcfa: 25_000,
              boostPriceFcfa: 5_000,
            }),
          },
        },
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

      it('une agence avec abonnement STARTER actif n’a aucun plafond de nombre d’annonces (2026-10-02)', async () => {
        // Avant le 2026-10-02, le plan STARTER était plafonné à 10 annonces.
        // Ce plafond a été retiré : un abonnement actif, STARTER ou PRO,
        // donne un nombre d'annonces illimité. Seuls AlloVérifié/Boost
        // restent payants en STARTER (voir isProActive).
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          ...proAgenceOwner,
          subscription: {
            status: SubscriptionStatus.ACTIVE,
            plan: SubscriptionPlan.STARTER,
          },
        });
        prismaMock.listing.create.mockResolvedValueOnce({
          id: 'l11',
          status: ListingStatus.ACTIVE,
        });

        await expect(
          service.create('owner1', { status: ListingStatus.ACTIVE } as never),
        ).resolves.toBeDefined();
        expect(prismaMock.listing.create).toHaveBeenCalled();
        // Plus de plafond à vérifier : le compte des annonces existantes ne
        // doit même plus être interrogé pour une agence abonnée.
        expect(prismaMock.listing.count).not.toHaveBeenCalled();
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

      it('un BAILLEUR individuel (non PRO_AGENCE) publie sans abonnement, sous le plafond de 10 annonces actives', async () => {
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          id: 'owner1',
          roles: [Role.BAILLEUR],
          subscription: null,
        });
        prismaMock.listing.count.mockResolvedValueOnce(9);
        prismaMock.listing.create.mockResolvedValueOnce({
          id: 'l1',
          status: ListingStatus.ACTIVE,
        });

        await expect(
          service.create('owner1', { status: ListingStatus.ACTIVE } as never),
        ).resolves.toBeDefined();
        expect(prismaMock.listing.count).toHaveBeenCalledWith({
          where: { ownerId: 'owner1', status: ListingStatus.ACTIVE },
        });
      });

      it('un BAILLEUR au plafond de 10 annonces actives est rejeté (2026-10-02)', async () => {
        // Avant le 2026-10-02, un bailleur particulier n'avait aucune limite.
        // Un plafond fixe de 10 annonces actives a été introduit, indépendant
        // de tout système d'abonnement (les bailleurs particuliers n'en ont
        // pas).
        prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
          id: 'owner1',
          roles: [Role.BAILLEUR],
          subscription: null,
        });
        prismaMock.listing.count.mockResolvedValueOnce(10);

        await expect(
          service.create('owner1', { status: ListingStatus.ACTIVE } as never),
        ).rejects.toMatchObject({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          response: expect.objectContaining({
            code: 'ACTIVE_LISTING_LIMIT',
            limit: 10,
          }),
        });
        expect(prismaMock.listing.create).not.toHaveBeenCalled();
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

        await service.update(
          'l1',
          { id: 'owner1', roles: [Role.PRO_AGENCE] } as User,
          {
            title: 'Nouveau titre',
          },
        );

        expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
      });
    });
  });

  // Nouveau (2026-10-02) : mode VENTE (vente directe), réservé aux agences
  // PRO_AGENCE avec abonnement actif — vérifié dès la création, y compris en
  // DRAFT, et indépendamment de assertCanPublish() (qui ne couvre que le
  // passage en ACTIVE). Couvre aussi la cohérence type de bien ↔ mode.
  describe('mode VENTE (vente directe)', () => {
    it('rejette une création VENTE pour un BAILLEUR individuel (non PRO_AGENCE)', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });

      await expect(
        service.create('owner1', {
          transactionType: 'VENTE',
          type: 'APPARTEMENT',
          status: ListingStatus.DRAFT,
        } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.listing.create).not.toHaveBeenCalled();
    });

    it('rejette une création VENTE pour une agence PRO_AGENCE sans abonnement actif', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: {
          status: SubscriptionStatus.CANCELLED,
          plan: SubscriptionPlan.PRO,
        },
      });

      await expect(
        service.create('owner1', {
          transactionType: 'VENTE',
          type: 'APPARTEMENT',
          status: ListingStatus.DRAFT,
        } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.listing.create).not.toHaveBeenCalled();
    });

    it('autorise une création VENTE en DRAFT pour une agence avec abonnement STARTER actif', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: {
          status: SubscriptionStatus.ACTIVE,
          plan: SubscriptionPlan.STARTER,
        },
      });
      prismaMock.listing.create.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.DRAFT,
        transactionType: 'VENTE',
      });

      await expect(
        service.create('owner1', {
          transactionType: 'VENTE',
          type: 'TERRAIN',
          price: 45_000_000,
          status: ListingStatus.DRAFT,
        } as never),
      ).resolves.toBeDefined();
      expect(prismaMock.listing.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          transactionType: 'VENTE',
          price: 45_000_000,
          status: ListingStatus.DRAFT,
        }),
      });
      // assertValidNightsRange/resolveMonthlyPrice (logique location) ne
      // doivent jamais entrer en jeu pour une annonce en vente.
      expect(prismaMock.listing.count).not.toHaveBeenCalled();
    });

    it('rejette un type réservé à la location (CHAMBRE) combiné avec transactionType VENTE', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: {
          status: SubscriptionStatus.ACTIVE,
          plan: SubscriptionPlan.PRO,
        },
      });

      await expect(
        service.create('owner1', {
          transactionType: 'VENTE',
          type: 'CHAMBRE',
          price: 1000,
          status: ListingStatus.DRAFT,
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.listing.create).not.toHaveBeenCalled();
    });

    it('rejette un type réservé à la vente (TERRAIN) combiné avec transactionType LOCATION (par défaut)', async () => {
      await expect(
        service.create('owner1', {
          type: 'TERRAIN',
          rentalMode: 'MONTHLY',
          price: 1000,
          status: ListingStatus.DRAFT,
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.listing.create).not.toHaveBeenCalled();
      // LOCATION est le défaut (pas de PRO_AGENCE à vérifier) : seul le
      // contrôle de cohérence de type se déclenche, pas de fetch owner.
      expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  // Régression (2026-10-02) : restoreListing() faisait passer une annonce
  // SUSPENDED → ACTIVE sans jamais appeler assertCanPublish(), contrairement
  // à create()/update()/publishListing() — un bailleur au plafond pouvait
  // contourner la limite de 10 annonces actives en archivant puis restaurant.
  describe('restoreListing', () => {
    it('restaure en ACTIVE un bailleur particulier sous le plafond', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.SUSPENDED,
      });
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });
      prismaMock.listing.count.mockResolvedValueOnce(9);
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.ACTIVE,
      });

      await expect(
        service.restoreListing('l1', 'owner1', 'ACTIVE'),
      ).resolves.toBeDefined();
      expect(prismaMock.listing.count).toHaveBeenCalledWith({
        where: { ownerId: 'owner1', status: ListingStatus.ACTIVE },
      });
    });

    it('rejette la restauration en ACTIVE si le bailleur particulier est au plafond de 10', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.SUSPENDED,
      });
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });
      prismaMock.listing.count.mockResolvedValueOnce(10);

      await expect(
        service.restoreListing('l1', 'owner1', 'ACTIVE'),
      ).rejects.toMatchObject({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        response: expect.objectContaining({
          code: 'ACTIVE_LISTING_LIMIT',
          limit: 10,
        }),
      });
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });

    it('une agence avec abonnement actif restaure en ACTIVE sans vérifier le plafond', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.SUSPENDED,
      });
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: {
          status: SubscriptionStatus.ACTIVE,
          plan: SubscriptionPlan.STARTER,
        },
      });
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.ACTIVE,
      });

      await expect(
        service.restoreListing('l1', 'owner1', 'ACTIVE'),
      ).resolves.toBeDefined();
      expect(prismaMock.listing.count).not.toHaveBeenCalled();
    });

    it('restaurer en DRAFT ne vérifie jamais le plafond (pas un chemin vers ACTIVE)', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        ownerId: 'owner1',
        status: ListingStatus.SUSPENDED,
      });
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        status: ListingStatus.DRAFT,
      });

      await expect(
        service.restoreListing('l1', 'owner1', 'DRAFT'),
      ).resolves.toBeDefined();
      expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
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

    // Montant figé à l'initiation (BoostPayment.amount) : le webhook compare à
    // celui-ci, pas au tarif courant que l'admin peut avoir modifié entre-temps.
    it("accepte un paiement au montant figé à l'initiation même si le tarif courant a changé", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'l1' },
      });
      prismaMock.boostPayment.findFirst.mockResolvedValueOnce({
        id: 'bp1',
        listingId: 'l1',
        status: 'PENDING',
        amount: 3_000, // ancien tarif ; le tarif courant (mock) est 5 000
      });
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'l1',
        boostScore: 0,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 3_000,
        customData: {},
      });

      await service.handleBoostWebhookPayDunya({});

      expect(prismaMock.boostPayment.update).toHaveBeenCalledWith({
        where: { id: 'bp1' },
        data: { status: 'CONFIRMED', paymentRef: 'PD-tok1' },
      });
      expect(prismaMock.listing.update).toHaveBeenCalled();
    });

    it('rejette un paiement dont le montant diffère du montant figé, sans appliquer le boost', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'l1' },
      });
      prismaMock.boostPayment.findFirst.mockResolvedValueOnce({
        id: 'bp1',
        listingId: 'l1',
        status: 'PENDING',
        amount: 5_000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 100,
        customData: {},
      });

      await expect(service.handleBoostWebhookPayDunya({})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.boostPayment.update).not.toHaveBeenCalled();
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });

    it('retombe sur le tarif courant pour un ancien paiement sans montant figé (amount null) et rejette un montant incohérent', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { listing_id: 'l1' },
      });
      prismaMock.boostPayment.findFirst.mockResolvedValueOnce({
        id: 'bp1',
        listingId: 'l1',
        status: 'PENDING',
        amount: null,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 100,
        customData: {},
      });

      await expect(service.handleBoostWebhookPayDunya({})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
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

  // Confirmation utilisateur 2026-09-10 : un abonnement PRO actif inclut le
  // boost en illimité, sans repasser par PayDunya à chaque fois.
  describe('boost', () => {
    const listing = { id: 'l1', ownerId: 'owner1', boostScore: 20 };

    it("refuse si l'appelant n'est pas le propriétaire", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(listing as never);

      await expect(
        service.boost('l1', { id: 'other' } as User),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('applique le boost directement (gratuit) pour un abonnement PRO actif — pas de PayDunya', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(listing as never);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: {
          plan: SubscriptionPlan.PRO,
          status: SubscriptionStatus.ACTIVE,
        },
      });
      prismaMock.listing.update.mockResolvedValueOnce({
        id: 'l1',
        boostUntil: new Date(),
        boostScore: 30,
      });

      const result = await service.boost('l1', { id: 'owner1' } as User);

      expect(result).toMatchObject({ free: true, boosted: true });
      expect(prismaMock.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'l1' } }),
      );
    });

    it('passe par PayDunya pour un plan STARTER (pas de gratuité)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(listing as never);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.PRO_AGENCE],
        subscription: {
          plan: SubscriptionPlan.STARTER,
          status: SubscriptionStatus.ACTIVE,
        },
      });
      configMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'PAYDUNYA_DEV_BYPASS') return 'true';
        return undefined;
      });
      prismaMock.boostPayment.create.mockResolvedValueOnce({ id: 'bp1' });

      const result = await service.boost('l1', { id: 'owner1' } as User);

      expect(result).not.toHaveProperty('free');
      expect(result).toHaveProperty('payment_url');
      expect(prismaMock.boostPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 5_000 }) as unknown,
      });
    });

    it('passe par PayDunya pour un bailleur individuel sans abonnement', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(listing as never);
      prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'owner1',
        roles: [Role.BAILLEUR],
        subscription: null,
      });
      configMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'PAYDUNYA_DEV_BYPASS') return 'true';
        return undefined;
      });
      prismaMock.boostPayment.create.mockResolvedValueOnce({ id: 'bp1' });

      const result = await service.boost('l1', { id: 'owner1' } as User);

      expect(result).not.toHaveProperty('free');
      expect(result).toHaveProperty('payment_url');
    });
  });

  // Ces stats alimentent la page d'accueil publique — elles remplacent des
  // chiffres codés en dur ("2 400+", "14", "98%") qui n'avaient jamais reflété
  // les vraies données. Doivent toujours venir de la base, jamais inventées.
  describe('getPublicStats', () => {
    it("calcule le nombre d'annonces actives, de régions et le % vérifié", async () => {
      prismaMock.listing.count
        .mockResolvedValueOnce(50) // activeListings
        .mockResolvedValueOnce(10); // verifiedListings
      prismaMock.listing.groupBy.mockResolvedValueOnce([
        { region: 'Dakar' },
        { region: 'Thiès' },
        { region: 'Saint-Louis' },
      ]);

      const result = await service.getPublicStats();

      expect(result).toEqual({
        activeListings: 50,
        regionsCount: 3,
        verifiedPercent: 20,
      });
      expect(prismaMock.listing.count).toHaveBeenNthCalledWith(1, {
        where: { status: ListingStatus.ACTIVE },
      });
      expect(prismaMock.listing.count).toHaveBeenNthCalledWith(2, {
        where: { status: ListingStatus.ACTIVE, isVerified: true },
      });
    });

    it("retourne 0% vérifié sans planter quand il n'y a aucune annonce active", async () => {
      prismaMock.listing.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.listing.groupBy.mockResolvedValueOnce([]);

      const result = await service.getPublicStats();

      expect(result).toEqual({
        activeListings: 0,
        regionsCount: 0,
        verifiedPercent: 0,
      });
    });
  });

  // Milo Search v0 — lot 1a (PLAN_SEARCH_V0.md § 2.h) : nouveau filtre
  // minBeds/maxBeds (champ "Chambres"), distinct de minRooms/maxRooms
  // (champ "Pièces") déjà existant. Mêmes validateurs/transformations que
  // minRooms/maxRooms côté DTO ; même construction gte/lte côté service —
  // ces tests vérifient uniquement la clause `where` passée à Prisma (la
  // sémantique gte/lte sur un champ nullable, qui exclut les NULL dès
  // qu'un filtre est actif, est déléguée à Prisma/Postgres, comme pour
  // `rooms` et `surface` déjà en place).
  describe('findAll — filtre minBeds/maxBeds', () => {
    const fakeListing = {
      id: 'l1',
      boostScore: 0,
      isVerified: false,
      boostUntil: null,
      createdAt: new Date('2026-01-01'),
      owner: { id: 'o1', roles: [], subscription: null },
      reviews: [],
    };

    beforeEach(() => {
      prismaMock.listing.findMany.mockResolvedValue([fakeListing]);
    });

    function whereArg(): Record<string, unknown> {
      const calls = prismaMock.listing.findMany.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >;
      return calls[calls.length - 1][0].where;
    }

    it('sans minBeds/maxBeds : aucune clause beds dans le where (comportement inchangé)', async () => {
      await service.findAll({ page: 1, limit: 20 });
      expect(whereArg()).not.toHaveProperty('beds');
    });

    it('minBeds seul → { gte }', async () => {
      await service.findAll({ page: 1, limit: 20, minBeds: 2 });
      expect(whereArg().beds).toEqual({ gte: 2 });
    });

    it('maxBeds seul → { lte }', async () => {
      await service.findAll({ page: 1, limit: 20, maxBeds: 3 });
      expect(whereArg().beds).toEqual({ lte: 3 });
    });

    it('minBeds et maxBeds ensemble → { gte, lte }', async () => {
      await service.findAll({ page: 1, limit: 20, minBeds: 2, maxBeds: 4 });
      expect(whereArg().beds).toEqual({ gte: 2, lte: 4 });
    });

    it('combiné avec minRooms/maxRooms : les deux clauses coexistent, indépendantes', async () => {
      await service.findAll({
        page: 1,
        limit: 20,
        minBeds: 2,
        maxRooms: 5,
      });
      const where = whereArg();
      expect(where.beds).toEqual({ gte: 2 });
      expect(where.rooms).toEqual({ lte: 5 });
    });

    it("une annonce avec beds=null est renvoyée par Prisma quand aucun filtre beds n'est actif (where sans clause beds, vérifié ci-dessus) — le service ne filtre pas lui-même en mémoire", async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        { ...fakeListing, id: 'l-null-beds', beds: null },
      ]);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(whereArg()).not.toHaveProperty('beds');
    });
  });

  // Milo Search v0 — lot 2b (PLAN_SEARCH_V0.md § 1.d) : city est un champ
  // texte libre à la publication (78 % des valeurs en base ne correspondent
  // à aucune ville canonique) — cityContains est un filtre TOLÉRANT en plus
  // de `city` (égalité exacte, inchangée). Appliqué en JS après findMany
  // (comme le score/tri déjà en place), avec le même normalizeText que
  // Milo : insensible à la casse ET aux accents, dans les deux sens (query
  // accentuée/valeur non accentuée, ou l'inverse).
  describe('findAll — filtre cityContains (Milo, tolérant)', () => {
    function fakeListingWithCity(id: string, city: string) {
      return {
        id,
        city,
        boostScore: 0,
        isVerified: false,
        boostUntil: null,
        createdAt: new Date('2026-01-01'),
        owner: { id: 'o1', roles: [], subscription: null },
        reviews: [],
      };
    }

    function whereArg(): Record<string, unknown> {
      const calls = prismaMock.listing.findMany.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >;
      return calls[calls.length - 1][0].where;
    }

    it('sans cityContains : comportement strictement identique (where inchangé, aucune donnée retirée)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Ngor almadies'),
        fakeListingWithCity('l2', 'Médina fall'),
      ]);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(2);
      expect(whereArg()).not.toHaveProperty('cityContains');
    });

    it('insensible à la casse ("almadies" trouve "Almadies")', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Almadies'),
        fakeListingWithCity('l2', 'Mbour'),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        cityContains: 'almadies',
      });
      expect(result.data.map((d) => d.id)).toEqual(['l1']);
    });

    it("« Ngor almadies » trouvé par « Almadies » (sous-chaîne, pas d'accent en jeu)", async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Ngor almadies'),
        fakeListingWithCity('l2', 'Mbour'),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        cityContains: 'Almadies',
      });
      expect(result.data.map((d) => d.id)).toEqual(['l1']);
    });

    it('« Médina fall » trouvé par « Medina » (valeur accentuée en base, recherche sans accent)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Médina fall'),
        fakeListingWithCity('l2', 'Plateau'),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        cityContains: 'Medina',
      });
      expect(result.data.map((d) => d.id)).toEqual(['l1']);
    });

    it("fonctionne aussi dans l'autre sens (recherche accentuée, valeur sans accent en base)", async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Medina fall'),
        fakeListingWithCity('l2', 'Plateau'),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        cityContains: 'Médina',
      });
      expect(result.data.map((d) => d.id)).toEqual(['l1']);
    });

    it('aucune correspondance → liste vide (pas une erreur)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Plateau'),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        cityContains: 'Almadies',
      });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('annonce sans city (null) : jamais une correspondance, jamais une erreur', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        { ...fakeListingWithCity('l1', 'Plateau'), city: null },
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        cityContains: 'Plateau',
      });
      expect(result.data).toHaveLength(0);
    });

    it('combiné avec region : les deux filtres cohabitent (region au niveau Prisma, cityContains en JS)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Almadies'),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        region: 'Dakar',
        cityContains: 'almadies',
      });
      expect(whereArg().region).toBe('Dakar');
      expect(whereArg()).not.toHaveProperty('cityContains');
      expect(result.data.map((d) => d.id)).toEqual(['l1']);
    });

    it("n'affecte jamais `city` (égalité exacte) : les deux restent indépendants", async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListingWithCity('l1', 'Almadies'),
      ]);
      await service.findAll({ page: 1, limit: 20, city: 'Almadies' });
      expect(whereArg().city).toBe('Almadies');
      expect(whereArg()).not.toHaveProperty('cityContains');
    });
  });

  describe('findAll — classement par préférences floues (Milo, lot 6a)', () => {
    function whereArg(): Record<string, unknown> {
      const calls = prismaMock.listing.findMany.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >;
      return calls[calls.length - 1][0].where;
    }

    function fakeListing(
      id: string,
      title: string,
      description = '',
      opts: { boostScore?: number; createdAt?: Date } = {},
    ) {
      return {
        id,
        title,
        description,
        city: 'Dakar',
        boostScore: opts.boostScore ?? 0,
        isVerified: false,
        boostUntil: null,
        createdAt: opts.createdAt ?? new Date('2026-01-01'),
        owner: { id: 'o1', roles: [], subscription: null },
        reviews: [],
      };
    }

    it('sans prefs : comportement strictement identique à aujourd’hui (ordre par priorité/date uniquement)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('l1', 'Villa standard', '', { boostScore: 5 }),
        fakeListing('l2', 'Villa vue mer', '', { boostScore: 10 }),
      ]);
      const result = await service.findAll({ page: 1, limit: 20 });
      // Priorité seule décide : l2 (boost 10) avant l1 (boost 5), le mot
      // "mer" dans le titre de l2 n'a aucun effet sans `prefs`.
      expect(result.data.map((d) => d.id)).toEqual(['l2', 'l1']);
    });

    it('1 préférence : une annonce correspondante passe devant une annonce boostée sans le mot-clé', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('boosted', 'Villa standard', '', { boostScore: 50 }),
        fakeListing('sea', 'Villa vue mer', '', { boostScore: 0 }),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea'],
      });
      expect(result.data.map((d) => d.id)).toEqual(['sea', 'boosted']);
    });

    it('2 préférences : une annonce qui correspond aux deux passe devant une annonce qui n’en a qu’une', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('one', 'Villa calme', ''),
        fakeListing('two', 'Villa calme vue mer', ''),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea', 'quiet'],
      });
      expect(result.data.map((d) => d.id)).toEqual(['two', 'one']);
    });

    it('égalité de score de préférence : retombe sur le score de priorité existant', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('low', 'Villa calme', '', { boostScore: 0 }),
        fakeListing('high', 'Maison calme', '', { boostScore: 20 }),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['quiet'],
      });
      expect(result.data.map((d) => d.id)).toEqual(['high', 'low']);
    });

    it('aucun mot-clé trouvé pour aucune annonce : ordre inchangé (retombe sur la priorité)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('a', 'Studio simple', '', { boostScore: 1 }),
        fakeListing('b', 'Appartement basique', '', { boostScore: 5 }),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea', 'upscale'],
      });
      expect(result.data.map((d) => d.id)).toEqual(['b', 'a']);
    });

    it('accents : "océan" dans le titre compte pour near_sea', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('plain', 'Villa simple', ''),
        fakeListing('ocean', 'Villa près de l’océan', ''),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea'],
      });
      expect(result.data.map((d) => d.id)).toEqual(['ocean', 'plain']);
    });

    it('fonctionne en anglais (seafront)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('plain', 'Standard flat', ''),
        fakeListing('sea', 'Seafront apartment', ''),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea'],
      });
      expect(result.data.map((d) => d.id)).toEqual(['sea', 'plain']);
    });

    it('identifiant inconnu dans prefs : ignoré, aucune erreur, aucun effet sur le tri', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('a', 'Villa simple', '', { boostScore: 1 }),
        fakeListing('b', 'Villa vue mer', '', { boostScore: 5 }),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['bogus'],
      });
      // Seul "bogus" est demandé (inconnu) : aucun score de préférence nulle
      // part, retombe sur la priorité — comme sans prefs.
      expect(result.data.map((d) => d.id)).toEqual(['b', 'a']);
    });

    it('combiné avec un filtre strict (region) : les deux cohabitent, aucune annonce exclue par prefs', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('a', 'Villa simple', ''),
        fakeListing('b', 'Villa vue mer', ''),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        region: 'Dakar',
        prefs: ['near_sea'],
      });
      expect(whereArg().region).toBe('Dakar');
      expect(result.total).toBe(2); // aucune annonce exclue par prefs
      expect(result.data.map((d) => d.id)).toEqual(['b', 'a']);
    });

    it('prefsMatched=false quand aucune annonce ne contient le mot-clé (message honnête possible côté Frontend)', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('a', 'Villa simple', ''),
        fakeListing('b', 'Appartement basique', ''),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea'],
      });
      expect(result.prefsMatched).toBe(false);
    });

    it('prefsMatched=true dès qu’une annonce correspond', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('a', 'Villa simple', ''),
        fakeListing('b', 'Villa vue mer', ''),
      ]);
      const result = await service.findAll({
        page: 1,
        limit: 20,
        prefs: ['near_sea'],
      });
      expect(result.prefsMatched).toBe(true);
    });

    it('prefsMatched absent (undefined) quand prefs n’est pas demandé', async () => {
      prismaMock.listing.findMany.mockResolvedValueOnce([
        fakeListing('a', 'Villa simple', ''),
      ]);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.prefsMatched).toBeUndefined();
    });

    it('pagination cohérente avec le tri par préférence (page 2 contient le reste, triées)', async () => {
      const data = [
        fakeListing('a', 'Villa simple', ''),
        fakeListing('b', 'Villa vue mer', ''),
        fakeListing('c', 'Maison simple', ''),
      ];
      prismaMock.listing.findMany.mockResolvedValue(data);
      const page1 = await service.findAll({
        page: 1,
        limit: 1,
        prefs: ['near_sea'],
      });
      const page2 = await service.findAll({
        page: 2,
        limit: 1,
        prefs: ['near_sea'],
      });
      expect(page1.total).toBe(3);
      expect(page1.data.map((d) => d.id)).toEqual(['b']); // meilleur score en page 1
      expect(page2.data.map((d) => d.id)).not.toContain('b');
    });
  });
});
