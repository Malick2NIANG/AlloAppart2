import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { ContractsService } from '../contracts/contracts.service';
import { BookingStatus, EscrowStatus } from '@prisma/client';
import axios from 'axios';

// Utilisé par PaymentsService.verifyBooking() (appel direct à l'API PayDunya,
// distinct du PaydunyaSoftpayService injecté utilisé par le webhook).
jest.mock('axios');
const axiosGetMock = axios.get as jest.Mock;

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: {
    booking: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    listing: { update: jest.Mock };
  };
  let softpayMock: {
    verifyAndParseCallback: jest.Mock;
    confirmInvoiceStatus: jest.Mock;
  };
  let notificationsMock: { notifyPaymentConfirmed: jest.Mock };
  let contractsMock: { generateForBooking: jest.Mock };
  let configMock: { get: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      booking: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        update: jest.fn(),
      },
    };
    softpayMock = {
      verifyAndParseCallback: jest.fn(),
      confirmInvoiceStatus: jest.fn(),
    };
    notificationsMock = {
      notifyPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    };
    contractsMock = {
      generateForBooking: jest.fn().mockResolvedValue({ id: 'contract1' }),
    };
    // Par défaut, aucune clé PayDunya configurée (comme la plupart des specs
    // existantes) — chaque test qui en a besoin surcharge via mockImplementation.
    configMock = { get: jest.fn().mockReturnValue(undefined) };
    axiosGetMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: PaydunyaSoftpayService, useValue: softpayMock },
        { provide: ContractsService, useValue: contractsMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Régression : le webhook IPN PayDunya faisait auparavant confiance au
  // statut/montant contenus dans le payload entrant (potentiellement rejoué
  // ou forgé). Il doit désormais systématiquement revérifier lui-même le
  // statut auprès de PayDunya via confirmInvoiceStatus, jamais depuis le
  // payload du webhook.
  describe('handlePaydunyaWebhook', () => {
    it('rejette le payload si verifyAndParseCallback échoue (hash invalide)', async () => {
      softpayMock.verifyAndParseCallback.mockImplementation(() => {
        throw new BadRequestException('Invalid callback signature');
      });

      await expect(
        service.handlePaydunyaWebhook({ data: { hash: 'bidon' } }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    });

    it('ignore silencieusement si aucun booking_id dans custom_data', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: {},
      });

      const result = await service.handlePaydunyaWebhook({});

      expect(result).toEqual({ ok: true });
      expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    });

    it('ne fait rien si le booking est déjà CONFIRMED (idempotence)', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { booking_id: 'b1' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BookingStatus.CONFIRMED,
        totalAmount: 10000,
      });

      const result = await service.handlePaydunyaWebhook({});

      expect(result).toEqual({ ok: true });
      expect(softpayMock.confirmInvoiceStatus).not.toHaveBeenCalled();
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });

    it('ne fait JAMAIS confiance au statut du payload — confirme via confirmInvoiceStatus', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { booking_id: 'b1' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BookingStatus.PENDING,
        totalAmount: 10000,
      });
      // Appel interne de markBookingPaid : lit le bookingType pour bifurquer.
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b1',
        bookingType: 'NIGHTLY',
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        id: 'b1',
        listingId: 'l1',
        tenant: { email: 't@x.com', firstName: 'T', lastName: 'T' },
        listing: {
          owner: {
            email: 'o@x.com',
            firstName: 'O',
            lastName: 'O',
            id: 'o1',
          },
          title: 'X',
          city: 'Dakar',
        },
        totalAmount: 10000,
        platformFee: 0,
        landlordAmount: 10000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 10000,
        customData: {},
      });

      await service.handlePaydunyaWebhook({
        data: { status: 'completed' /* ignoré */ },
      });

      expect(softpayMock.confirmInvoiceStatus).toHaveBeenCalledWith('tok1');
      expect(prismaMock.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: {
          status: BookingStatus.CONFIRMED,
          escrowStatus: EscrowStatus.HELD,
          paymentRef: 'PD-tok1',
        },
        include: { listing: { include: { owner: true } }, tenant: true },
      });
      // Réservation nuitée : l'annonce ne bascule pas en RENTED, et aucun
      // contrat de bail n'est généré (contrats = baux mensuels uniquement).
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
      expect(contractsMock.generateForBooking).not.toHaveBeenCalled();
    });

    it("MONTHLY : active le bail et bascule l'annonce en RENTED", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok2',
        customData: { booking_id: 'b2' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b2',
        status: BookingStatus.APPROVED,
        totalAmount: 250000,
      });
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b2',
        bookingType: 'MONTHLY',
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        id: 'b2',
        listingId: 'l2',
        tenant: { email: 't@x.com', firstName: 'T', lastName: 'T' },
        listing: {
          owner: { email: 'o@x.com', firstName: 'O', lastName: 'O', id: 'o1' },
          title: 'X',
          city: 'Dakar',
        },
        totalAmount: 250000,
        platformFee: 0,
        landlordAmount: 250000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 250000,
        customData: {},
      });

      await service.handlePaydunyaWebhook({});

      expect(prismaMock.booking.update).toHaveBeenCalledWith({
        where: { id: 'b2' },
        data: {
          status: BookingStatus.ACTIVE,
          escrowStatus: EscrowStatus.HELD,
          paymentRef: 'PD-tok2',
        },
        include: { listing: { include: { owner: true } }, tenant: true },
      });
      expect(prismaMock.listing.update).toHaveBeenCalledWith({
        where: { id: 'l2' },
        data: { status: 'RENTED' },
      });
      // Le contrat de bail est généré (best-effort) dès l'activation du bail.
      expect(contractsMock.generateForBooking).toHaveBeenCalledWith('b2');
    });

    it("la génération du contrat qui échoue n'empêche pas la confirmation du paiement", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok3',
        customData: { booking_id: 'b3' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b3',
        status: BookingStatus.APPROVED,
        totalAmount: 250000,
      });
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b3',
        bookingType: 'MONTHLY',
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        id: 'b3',
        listingId: 'l3',
        tenant: { email: 't@x.com', firstName: 'T', lastName: 'T' },
        listing: {
          owner: { email: 'o@x.com', firstName: 'O', lastName: 'O', id: 'o1' },
          title: 'X',
          city: 'Dakar',
        },
        totalAmount: 250000,
        platformFee: 0,
        landlordAmount: 250000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 250000,
        customData: {},
      });
      contractsMock.generateForBooking.mockRejectedValueOnce(
        new Error('PDF generation failed'),
      );

      // Ne doit pas rejeter malgré l'échec de generateForBooking (best-effort).
      const result = await service.handlePaydunyaWebhook({});
      expect(result).toEqual({ ok: true });
    });

    it('rejette si le montant confirmé par PayDunya ne correspond pas au montant attendu', async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { booking_id: 'b1' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BookingStatus.PENDING,
        totalAmount: 10000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'completed',
        totalAmount: 500, // montant incohérent
        customData: {},
      });

      await expect(service.handlePaydunyaWebhook({})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });

    it("marque le booking CANCELLED si PayDunya confirme un statut 'cancelled'", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { booking_id: 'b1' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BookingStatus.PENDING,
        totalAmount: 10000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'cancelled',
        totalAmount: 0,
        customData: {},
      });

      await service.handlePaydunyaWebhook({});

      expect(prismaMock.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: {
          status: BookingStatus.CANCELLED,
          escrowStatus: EscrowStatus.REFUNDED,
        },
      });
    });

    it("ne touche à rien si le statut confirmé est 'pending'", async () => {
      softpayMock.verifyAndParseCallback.mockReturnValue({
        token: 'tok1',
        customData: { booking_id: 'b1' },
      });
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BookingStatus.PENDING,
        totalAmount: 10000,
      });
      softpayMock.confirmInvoiceStatus.mockResolvedValueOnce({
        status: 'pending',
        totalAmount: 10000,
        customData: {},
      });

      const result = await service.handlePaydunyaWebhook({});

      expect(result).toEqual({ ok: true });
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });
  });

  // Régression : verifyBooking() (appelée depuis /paiement/confirmation)
  // traitait tout statut PayDunya non 'completed' de façon identique —
  // 'cancelled'/'failed' (paiement définitivement refusé) restait confondu
  // avec 'pending' (encore en cours), laissant le booking bloqué en
  // PENDING/APPROVED pour toujours et la page de confirmation affichait un
  // écran "en cours de traitement" qui ne se résolvait jamais.
  describe('verifyBooking — échec/annulation PayDunya', () => {
    beforeEach(() => {
      configMock.get.mockImplementation((key: string) => ({
        PAYDUNYA_MASTER_KEY: 'mk',
        PAYDUNYA_PRIVATE_KEY: 'pk',
        PAYDUNYA_TOKEN: 'tk',
      })[key]);
    });

    it("marque le booking CANCELLED si PayDunya confirme 'cancelled'", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b20', tenantId: 't20', status: BookingStatus.PENDING,
        paymentRef: 'PD-tok20', totalAmount: 50000,
      });
      axiosGetMock.mockResolvedValueOnce({ data: { status: 'cancelled' } });
      prismaMock.booking.update.mockResolvedValueOnce({
        id: 'b20', status: BookingStatus.CANCELLED, escrowStatus: EscrowStatus.REFUNDED,
      });

      const result = await service.verifyBooking('b20', 't20');

      expect(prismaMock.booking.update).toHaveBeenCalledWith({
        where: { id: 'b20' },
        data: { status: BookingStatus.CANCELLED, escrowStatus: EscrowStatus.REFUNDED },
        include: { listing: { include: { owner: true } }, tenant: true },
      });
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it("marque le booking CANCELLED si PayDunya confirme 'failed'", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b21', tenantId: 't21', status: BookingStatus.APPROVED,
        paymentRef: 'PD-tok21', totalAmount: 75000,
      });
      axiosGetMock.mockResolvedValueOnce({ data: { status: 'failed' } });
      prismaMock.booking.update.mockResolvedValueOnce({
        id: 'b21', status: BookingStatus.CANCELLED, escrowStatus: EscrowStatus.REFUNDED,
      });

      const result = await service.verifyBooking('b21', 't21');

      expect(prismaMock.booking.update).toHaveBeenCalledWith({
        where: { id: 'b21' },
        data: { status: BookingStatus.CANCELLED, escrowStatus: EscrowStatus.REFUNDED },
        include: { listing: { include: { owner: true } }, tenant: true },
      });
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('ne réécrit rien si le booking est déjà CANCELLED (idempotence, webhook déjà passé)', async () => {
      const already = {
        id: 'b22', tenantId: 't22', status: BookingStatus.CANCELLED,
        paymentRef: 'PD-tok22', totalAmount: 30000,
      };
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(already);
      axiosGetMock.mockResolvedValueOnce({ data: { status: 'failed' } });

      const result = await service.verifyBooking('b22', 't22');

      expect(prismaMock.booking.update).not.toHaveBeenCalled();
      expect(result).toBe(already);
    });

    it("laisse le booking inchangé si PayDunya renvoie 'pending' (pas encore finalisé)", async () => {
      const pendingBooking = {
        id: 'b23', tenantId: 't23', status: BookingStatus.PENDING,
        paymentRef: 'PD-tok23', totalAmount: 40000,
      };
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(pendingBooking);
      axiosGetMock.mockResolvedValueOnce({ data: { status: 'pending' } });

      const result = await service.verifyBooking('b23', 't23');

      expect(prismaMock.booking.update).not.toHaveBeenCalled();
      expect(result).toBe(pendingBooking);
    });
  });

  // Régression : initiate() renvoyait aveuglément l'ancien lien PayDunya dès
  // qu'un checkout existait déjà (paymentRef PD-...), sans jamais revérifier
  // si la facture avait entre-temps été réglée côté PayDunya (le webhook IPN
  // n'arrive pas toujours, notamment en sandbox). Résultat : le locataire
  // payait, PayDunya affichait "facture déjà réglée" en cas de nouvel essai,
  // mais notre statut restait bloqué sur PENDING/APPROVED pour toujours.
  describe('initiate — réutilisation du checkout PayDunya', () => {
    it('revérifie via PayDunya, débloque le booking en base et rejette avec ALREADY_PAID si la facture est déjà réglée', async () => {
      configMock.get.mockImplementation((key: string) => ({
        PAYDUNYA_MASTER_KEY: 'mk',
        PAYDUNYA_PRIVATE_KEY: 'pk',
        PAYDUNYA_TOKEN: 'tk',
      })[key]);

      // 1) initiate() charge le booking
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b10', tenantId: 't10', bookingType: 'MONTHLY',
        status: BookingStatus.APPROVED, paymentRef: 'PD-tok10',
        totalAmount: 240000, listing: {}, tenant: {},
      });
      // 2) verifyBooking() recharge le booking (include différent)
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b10', tenantId: 't10', bookingType: 'MONTHLY',
        status: BookingStatus.APPROVED, paymentRef: 'PD-tok10',
        totalAmount: 240000, listing: { owner: {} }, tenant: {},
      });
      axiosGetMock.mockResolvedValueOnce({
        data: {
          status: 'completed',
          custom_data: { booking_id: 'b10' },
          invoice: { total_amount: 240000 },
        },
      });
      // 3) markBookingPaid() recharge le booking pour connaître bookingType
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b10', bookingType: 'MONTHLY',
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        id: 'b10', listingId: 'l10', tenantId: 't10',
        tenant: { email: 't@x.com', firstName: 'T', lastName: 'T' },
        listing: { owner: { email: 'o@x.com', firstName: 'O', lastName: 'O', id: 'o1' }, title: 'X', city: 'Dakar' },
        totalAmount: 240000, platformFee: 0, landlordAmount: 240000,
      });

      await expect(service.initiate('b10', 't10')).rejects.toThrow('ALREADY_PAID');

      // Le plus important : le statut a bien été débloqué en base, même si
      // la requête HTTP courante se termine par une erreur (le front
      // rafraîchit ensuite et voit le booking désormais payé).
      expect(prismaMock.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b10' },
          data: expect.objectContaining({ status: BookingStatus.ACTIVE }),
        }),
      );
      expect(prismaMock.listing.update).toHaveBeenCalledWith({
        where: { id: 'l10' },
        data: { status: 'RENTED' },
      });
    });

    it("réutilise l'URL existante si le paiement est encore 'pending' chez PayDunya", async () => {
      configMock.get.mockImplementation((key: string) => ({
        PAYDUNYA_MASTER_KEY: 'mk',
        PAYDUNYA_PRIVATE_KEY: 'pk',
        PAYDUNYA_TOKEN: 'tk',
      })[key]);

      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b11', tenantId: 't11', bookingType: 'NIGHTLY',
        status: BookingStatus.PENDING, paymentRef: 'PD-tok11',
        totalAmount: 90000, listing: {}, tenant: {},
      });
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b11', tenantId: 't11', bookingType: 'NIGHTLY',
        status: BookingStatus.PENDING, paymentRef: 'PD-tok11',
        totalAmount: 90000, listing: { owner: {} }, tenant: {},
      });
      axiosGetMock.mockResolvedValueOnce({ data: { status: 'pending' } });

      const result = await service.initiate('b11', 't11');

      expect(result.paymentToken).toBe('tok11');
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });

    it("réutilise l'URL existante sans appeler PayDunya si aucune clé n'est configurée (comportement historique préservé)", async () => {
      // configMock par défaut : get() renvoie undefined pour toute clé.
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b12', tenantId: 't12', bookingType: 'NIGHTLY',
        status: BookingStatus.PENDING, paymentRef: 'PD-tok12',
        totalAmount: 50000, listing: {}, tenant: {},
      });
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'b12', tenantId: 't12', bookingType: 'NIGHTLY',
        status: BookingStatus.PENDING, paymentRef: 'PD-tok12',
        totalAmount: 50000, listing: { owner: {} }, tenant: {},
      });

      const result = await service.initiate('b12', 't12');

      expect(result.paymentToken).toBe('tok12');
      expect(axiosGetMock).not.toHaveBeenCalled();
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });
  });
});
