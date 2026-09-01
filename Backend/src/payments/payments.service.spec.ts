import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { PaydunyaSoftpayService } from '../paydunya/paydunya-softpay.service';
import { BookingStatus, EscrowStatus } from '@prisma/client';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: PaydunyaSoftpayService, useValue: softpayMock },
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
      // Réservation nuitée : l'annonce ne bascule pas en RENTED.
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
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
});
