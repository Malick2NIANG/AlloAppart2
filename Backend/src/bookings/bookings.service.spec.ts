import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BookingStatus,
  BookingType,
  EscrowStatus,
  RentalMode,
  Role,
  type User,
} from '@prisma/client';

const owner: User = {
  id: 'owner1',
  clerkId: 'clerk_owner',
  email: 'owner@example.com',
  firstName: 'Fatou',
  lastName: 'Diallo',
  phone: '+221770000001',
  roles: [Role.LOCATAIRE, Role.BAILLEUR],
  agencyName: null,
  agencySlug: null,
  coverageZone: null,
  profileViews: 0,
  locale: 'fr',
  bailleurTermsAcceptedAt: null,
  termsAcceptedAt: null,
  bio: null,
  avatar: null,
  agencyBio: null,
  agencyAvatar: null,
  agencyPhone: null,
  isVerified: true,
  isSuspended: false,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const tenant: User = {
  id: 'tenant1',
  clerkId: 'clerk_tenant',
  email: 'tenant@example.com',
  firstName: 'Moussa',
  lastName: 'Ba',
  phone: '+221770000002',
  roles: [Role.LOCATAIRE],
  agencyName: null,
  agencySlug: null,
  coverageZone: null,
  profileViews: 0,
  locale: 'fr',
  bailleurTermsAcceptedAt: null,
  termsAcceptedAt: null,
  bio: null,
  avatar: null,
  agencyBio: null,
  agencyAvatar: null,
  agencyPhone: null,
  isVerified: false,
  isSuspended: false,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const listing = {
  id: 'listing1',
  ownerId: 'owner1',
  owner,
  title: 'Bel appartement Plateau',
  city: 'Dakar',
  price: 200000 as unknown as import('@prisma/client').Prisma.Decimal,
  status: 'ACTIVE',
};

const pendingBooking = {
  id: 'booking1',
  listingId: 'listing1',
  tenantId: 'tenant1',
  listing: { ...listing, owner },
  tenant,
  status: BookingStatus.PENDING,
  escrowStatus: EscrowStatus.AWAITING_PAYMENT,
  totalAmount: 200000 as unknown as import('@prisma/client').Prisma.Decimal,
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-08-01'),
  paymentRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BookingsService', () => {
  let service: BookingsService;
  let prismaMock: {
    listing: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    booking: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifMock: {
    notifyBookingCreated: jest.Mock;
    notifyBookingConfirmed: jest.Mock;
    notifyBookingCancelled: jest.Mock;
    notifyDisputeReported: jest.Mock;
    notifyDisputeResolved: jest.Mock;
    notifyMonthlyRequestCreated: jest.Mock;
    notifyMonthlyRequestApproved: jest.Mock;
    notifyMonthlyRequestRejected: jest.Mock;
    notifyLeaseTerminated: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      listing: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      booking: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...pendingBooking,
          status: BookingStatus.CONFIRMED,
        }),
      },
      $transaction: jest.fn(),
    };

    notifMock = {
      notifyBookingCreated: jest.fn().mockResolvedValue(undefined),
      notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined),
      notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
      notifyDisputeReported: jest.fn().mockResolvedValue(undefined),
      notifyDisputeResolved: jest.fn().mockResolvedValue(undefined),
      notifyMonthlyRequestCreated: jest.fn().mockResolvedValue(undefined),
      notifyMonthlyRequestApproved: jest.fn().mockResolvedValue(undefined),
      notifyMonthlyRequestRejected: jest.fn().mockResolvedValue(undefined),
      notifyLeaseTerminated: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notifMock },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  // --- create ---
  describe('create', () => {
    // Depuis le retrait de la bascule automatique vers le tarif mensuel
    // (les séjours longs passent désormais par createMonthlyRequest), une
    // annonce sans rentalMode ni pricePerNight retombe sur le prorata
    // loyer mensuel ÷ 30 × nuits, sans plus jamais "arrondir au mois".
    it('calcule totalAmount au prorata (pas de tarif/nuit defini, 31 nuits)', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        title: 'Appart Plateau',
        city: 'Dakar',
        owner,
      });
      prismaMock.booking.create.mockResolvedValueOnce({
        ...pendingBooking,
        totalAmount: 206667,
      });

      await service.create('tenant1', {
        listingId: 'listing1',
        startDate: '2026-07-01',
        endDate: '2026-08-01',
      });

      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ totalAmount: 206667 }),
        }),
      );
    });

    it('utilise le tarif/nuit quand il est defini, meme pour un long sejour sur une annonce NIGHTLY', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 100000,
        pricePerNight: 5000,
        title: 'Studio',
        city: 'Thies',
        owner,
      });
      prismaMock.booking.create.mockResolvedValueOnce({
        ...pendingBooking,
        totalAmount: 460000,
      });

      await service.create('tenant1', {
        listingId: 'listing1',
        startDate: '2026-07-01',
        endDate: '2026-10-01',
      });

      // 92 nuits (juil+aout+sept) x 5000 = 460000 — pas de bascule mensuelle,
      // pas de cap non plus (annonce NIGHTLY pure, aucune alternative mensuelle).
      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ totalAmount: 460000 }),
        }),
      );
    });

    // Champ optionnel maximumNights (mode NIGHTLY uniquement) — le bailleur
    // peut plafonner la durée d'un séjour en nuitée.
    it('leve BadRequestException si le sejour depasse maximumNights sur une annonce NIGHTLY', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 100000,
        pricePerNight: 5000,
        title: 'Studio',
        city: 'Thies',
        owner,
        rentalMode: RentalMode.NIGHTLY,
        maximumNights: 10,
      });

      await expect(
        service.create('tenant1', {
          listingId: 'listing1',
          startDate: '2026-07-01',
          endDate: '2026-07-12', // 11 nuits > 10
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });

    it('accepte un sejour egal a maximumNights sur une annonce NIGHTLY', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 100000,
        pricePerNight: 5000,
        title: 'Studio',
        city: 'Thies',
        owner,
        rentalMode: RentalMode.NIGHTLY,
        maximumNights: 10,
      });
      prismaMock.booking.create.mockResolvedValueOnce({
        ...pendingBooking,
        totalAmount: 50000,
      });

      await service.create('tenant1', {
        listingId: 'listing1',
        startDate: '2026-07-01',
        endDate: '2026-07-11', // 10 nuits = maximumNights, accepte
      });

      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ totalAmount: 50000 }),
        }),
      );
    });

    it("leve BadRequestException si l'annonce est exclusivement MONTHLY", async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        title: 'Appart',
        city: 'Dakar',
        owner,
        rentalMode: RentalMode.MONTHLY,
      });

      await expect(
        service.create('tenant1', {
          listingId: 'listing1',
          startDate: '2026-07-01',
          endDate: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });

    // Le seuil nuitée/mensuel d'une annonce MIXTE est la durée minimale du
    // bail (minLeaseMonths) fixée par le bailleur, convertie en jours — pas
    // une valeur fixe de 25 nuits.
    it('leve BadRequestException et suggere la location au mois si sejour >= minLeaseMonths sur une annonce MIXTE', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        pricePerNight: 8000,
        title: 'Appart',
        city: 'Dakar',
        owner,
        rentalMode: RentalMode.MIXED,
        minLeaseMonths: 1, // seuil = 30 nuits
      });

      await expect(
        service.create('tenant1', {
          listingId: 'listing1',
          startDate: '2026-07-01',
          endDate: '2026-07-31', // 30 nuits
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });

    it('accepte une reservation nuitee sous le seuil minLeaseMonths sur une annonce MIXTE', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        pricePerNight: 8000,
        title: 'Appart',
        city: 'Dakar',
        owner,
        rentalMode: RentalMode.MIXED,
        minLeaseMonths: 2, // seuil = 60 nuits
      });
      prismaMock.booking.create.mockResolvedValueOnce({
        ...pendingBooking,
        totalAmount: 80000,
      });

      await service.create('tenant1', {
        listingId: 'listing1',
        startDate: '2026-07-01',
        endDate: '2026-07-11', // 10 nuits
      });

      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ totalAmount: 80000 }),
        }),
      );
    });

    it("utilise le repli 1 mois si une annonce MIXTE (legacy) n'a pas de minLeaseMonths", async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        pricePerNight: 8000,
        title: 'Appart',
        city: 'Dakar',
        owner,
        rentalMode: RentalMode.MIXED,
        // minLeaseMonths absent — repli à 1 mois (30 nuits)
      });

      await expect(
        service.create('tenant1', {
          listingId: 'listing1',
          startDate: '2026-07-01',
          endDate: '2026-07-31', // 30 nuits
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });

    it('leve BadRequestException si dates chevauchement', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        title: 'Appart',
        city: 'Dakar',
        owner,
      });
      prismaMock.booking.findFirst.mockResolvedValueOnce(pendingBooking);

      await expect(
        service.create('tenant1', {
          listingId: 'listing1',
          startDate: '2026-07-01',
          endDate: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('leve BadRequestException si le logement est actuellement loue au mois (RENTED)', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        title: 'Appart',
        city: 'Dakar',
        owner,
        status: 'RENTED',
      });

      await expect(
        service.create('tenant1', {
          listingId: 'listing1',
          startDate: '2026-07-01',
          endDate: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });
  });

  // --- findOne ---
  describe('findOne', () => {
    it("retourne la reservation si l'utilisateur est le locataire", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce(pendingBooking);
      const result = await service.findOne('booking1', 'tenant1');
      expect(result).toEqual(pendingBooking);
    });

    it("retourne la reservation si l'utilisateur est le proprietaire", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce(pendingBooking);
      const result = await service.findOne('booking1', 'owner1');
      expect(result).toEqual(pendingBooking);
    });

    it('leve NotFoundException si booking inexistant', async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('unknown', 'tenant1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("leve ForbiddenException si l'utilisateur n'est ni tenant ni owner", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce(pendingBooking);
      await expect(service.findOne('booking1', 'hacker-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // --- confirm ---
  describe('confirm', () => {
    it('confirme la reservation si owner et statut PENDING', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        pendingBooking,
      );
      const result = await service.confirm('booking1', 'owner1');
      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it("leve ForbiddenException si l'utilisateur n'est pas l'owner", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        pendingBooking,
      );
      await expect(service.confirm('booking1', 'autre-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('leve BadRequestException si statut != PENDING', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.CONFIRMED,
      });
      await expect(service.confirm('booking1', 'owner1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // --- cancel ---
  describe('cancel', () => {
    it('leve BadRequestException si deja CANCELLED', async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.CANCELLED,
      });
      await expect(service.cancel('booking1', tenant)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('leve BadRequestException si deja COMPLETED', async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.COMPLETED,
      });
      await expect(service.cancel('booking1', tenant)).rejects.toThrow(
        BadRequestException,
      );
    });

    /* Politique d'annulation : > 7 jours avant l'arrivée → remboursement
     * intégral, sinon fonds libérés au bailleur. Les dates sont RELATIVES à
     * maintenant : une date fixe finit par tomber dans le passé et fait
     * basculer le test dans l'autre branche sans qu'on s'en aperçoive. */
    const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

    it("annule et rembourse l'escrow si l'arrivee est dans plus de 7 jours", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        ...pendingBooking,
        startDate: inDays(30),
        escrowStatus: EscrowStatus.HELD,
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.CANCELLED,
        escrowStatus: EscrowStatus.REFUNDED,
      });
      await service.cancel('booking1', tenant);
      expect(prismaMock.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            escrowStatus: EscrowStatus.REFUNDED,
          }),
        }),
      );
    });

    it("annule et libere les fonds au bailleur si l'arrivee est dans moins de 7 jours", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        ...pendingBooking,
        startDate: inDays(3),
        escrowStatus: EscrowStatus.HELD,
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.CANCELLED,
        escrowStatus: EscrowStatus.RELEASED,
      });
      await service.cancel('booking1', tenant);
      expect(prismaMock.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            escrowStatus: EscrowStatus.RELEASED,
          }),
        }),
      );
    });

    // Régression anti-fraude : la pénalité "annulation tardive → fonds
    // libérés au bailleur" ne doit s'appliquer que si c'est le LOCATAIRE qui
    // annule. Avant le fix, le bailleur pouvait confirmer une réservation
    // puis l'annuler lui-même juste avant l'arrivée pour empocher l'escrow
    // sans jamais fournir le logement.
    it("rembourse le locataire meme a moins de 7 jours si c'est le BAILLEUR qui annule — le contournement corrige", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.CONFIRMED,
        startDate: inDays(3),
        escrowStatus: EscrowStatus.HELD,
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        ...pendingBooking,
        status: BookingStatus.CANCELLED,
        escrowStatus: EscrowStatus.REFUNDED,
      });

      await service.cancel('booking1', owner);

      expect(prismaMock.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            escrowStatus: EscrowStatus.REFUNDED,
          }),
        }),
      );
    });
  });

  // --- complete ---
  describe('complete', () => {
    const confirmedBooking = {
      ...pendingBooking,
      status: BookingStatus.CONFIRMED,
      escrowStatus: EscrowStatus.HELD,
    };

    it("refuse de liberer l'escrow si le sejour n'est pas encore termine (anti-fraude)", async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedBooking,
        startDate: future,
        endDate: null,
      });

      await expect(service.complete('booking1', owner)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });

    it("libere l'escrow une fois la date de fin de sejour passee", async () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedBooking,
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: past,
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        ...confirmedBooking,
        status: BookingStatus.COMPLETED,
        escrowStatus: EscrowStatus.RELEASED,
      });

      const result = await service.complete('booking1', owner);

      expect(result.status).toBe(BookingStatus.COMPLETED);
      expect(prismaMock.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          status: BookingStatus.COMPLETED,
          escrowStatus: EscrowStatus.RELEASED,
        },
      });
    });

    it("se base sur startDate si aucune endDate n'est definie", async () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedBooking,
        startDate: past,
        endDate: null,
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        ...confirmedBooking,
        status: BookingStatus.COMPLETED,
      });

      await expect(service.complete('booking1', owner)).resolves.toBeDefined();
    });

    it("leve ForbiddenException si l'appelant n'est ni le proprietaire ni un admin", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedBooking,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: null,
      });

      await expect(service.complete('booking1', tenant)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("leve BadRequestException si la reservation n'est pas CONFIRMED", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedBooking,
        status: BookingStatus.PENDING,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: null,
      });

      await expect(service.complete('booking1', owner)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // --- reportDispute ---
  describe('reportDispute', () => {
    const confirmedHeld = {
      ...pendingBooking,
      status: BookingStatus.CONFIRMED,
      escrowStatus: EscrowStatus.HELD,
    };

    it("signale une non-conformité dans la fenêtre de 24h et gèle l'escrow", async () => {
      const startedRecently = new Date(Date.now() - 2 * 60 * 60 * 1000); // il y a 2h
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedHeld,
        startDate: startedRecently,
      });
      prismaMock.booking.update.mockResolvedValueOnce({
        ...confirmedHeld,
        escrowStatus: EscrowStatus.DISPUTED,
        disputeReason: 'Climatisation en panne',
        disputeEvidence: ['https://example.com/photo1.jpg'],
        disputedAt: new Date(),
      });

      const result = await service.reportDispute('booking1', 'tenant1', {
        reason: 'Climatisation en panne',
        evidence: ['https://example.com/photo1.jpg'],
      });

      expect(result.escrowStatus).toBe(EscrowStatus.DISPUTED);
      expect(notifMock.notifyDisputeReported).toHaveBeenCalled();
    });

    it('lève ForbiddenException si un autre user que le locataire signale', async () => {
      const startedRecently = new Date(Date.now() - 2 * 60 * 60 * 1000);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedHeld,
        startDate: startedRecently,
      });

      await expect(
        service.reportDispute('booking1', 'owner1', {
          reason: 'Climatisation en panne',
          evidence: ['https://example.com/photo1.jpg'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le délai de 24h est dépassé', async () => {
      const startedTooLongAgo = new Date(Date.now() - 30 * 60 * 60 * 1000); // il y a 30h
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedHeld,
        startDate: startedTooLongAgo,
      });

      await expect(
        service.reportDispute('booking1', 'tenant1', {
          reason: 'Climatisation en panne',
          evidence: ['https://example.com/photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.booking.update).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si le séjour n'a pas encore commencé", async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedHeld,
        startDate: future,
      });

      await expect(
        service.reportDispute('booking1', 'tenant1', {
          reason: 'Climatisation en panne',
          evidence: ['https://example.com/photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lève BadRequestException si l'escrow n'est pas HELD (déjà réglé)", async () => {
      const startedRecently = new Date(Date.now() - 2 * 60 * 60 * 1000);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...confirmedHeld,
        escrowStatus: EscrowStatus.RELEASED,
        startDate: startedRecently,
      });

      await expect(
        service.reportDispute('booking1', 'tenant1', {
          reason: 'Climatisation en panne',
          evidence: ['https://example.com/photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- resolveDispute ---
  describe('resolveDispute', () => {
    const disputedBooking = {
      ...pendingBooking,
      status: BookingStatus.CONFIRMED,
      escrowStatus: EscrowStatus.DISPUTED,
      disputeReason: 'Climatisation en panne',
      disputeEvidence: ['https://example.com/photo1.jpg'],
      disputedAt: new Date(),
    };
    const admin: User = { ...owner, id: 'admin1', roles: [Role.ADMIN] };

    it("lève ForbiddenException si le caller n'est pas ADMIN", async () => {
      await expect(
        service.resolveDispute('booking1', tenant, { decision: 'RELEASE' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.booking.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('RELEASE : passe la réservation en COMPLETED / escrow RELEASED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        disputedBooking,
      );
      prismaMock.booking.update.mockResolvedValueOnce({
        ...disputedBooking,
        status: BookingStatus.COMPLETED,
        escrowStatus: EscrowStatus.RELEASED,
      });

      const result = await service.resolveDispute('booking1', admin, {
        decision: 'RELEASE',
      });

      expect(result.status).toBe(BookingStatus.COMPLETED);
      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(notifMock.notifyDisputeResolved).toHaveBeenCalled();
    });

    it('REFUND : passe la réservation en CANCELLED / escrow REFUNDED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        disputedBooking,
      );
      prismaMock.booking.update.mockResolvedValueOnce({
        ...disputedBooking,
        status: BookingStatus.CANCELLED,
        escrowStatus: EscrowStatus.REFUNDED,
      });

      const result = await service.resolveDispute('booking1', admin, {
        decision: 'REFUND',
      });

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
    });

    it("lève BadRequestException si la réservation n'est pas en litige", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...disputedBooking,
        escrowStatus: EscrowStatus.HELD,
      });

      await expect(
        service.resolveDispute('booking1', admin, { decision: 'RELEASE' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- createMonthlyRequest ---
  describe('createMonthlyRequest', () => {
    const monthlyListing = {
      ...listing,
      rentalMode: RentalMode.MONTHLY,
      depositMonths: 2,
      owner,
    };
    const dto = { listingId: 'listing1', moveInDate: '2026-09-01' };

    beforeEach(() => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValue(monthlyListing);
      prismaMock.booking.create.mockResolvedValue({
        id: 'booking-monthly-1',
        listingId: 'listing1',
        tenantId: 'tenant1',
        bookingType: BookingType.MONTHLY,
        status: BookingStatus.REQUESTED,
        startDate: new Date('2026-09-01'),
        totalAmount: 600000,
        platformFee: 200000,
        landlordAmount: 400000,
        depositAmount: 400000,
        listing: monthlyListing,
        tenant,
      });
    });

    it('calcule loyer/caution/commission (1 mois) et crée la demande', async () => {
      const result = await service.createMonthlyRequest('tenant1', dto);

      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            listingId: 'listing1',
            tenantId: 'tenant1',
            bookingType: BookingType.MONTHLY,
            status: BookingStatus.REQUESTED,
            totalAmount: 600000, // 200000 (loyer) + 200000*2 (caution)
            platformFee: 200000, // commission = 1 mois de loyer
            landlordAmount: 400000, // caution - commission
            depositAmount: 400000,
          }),
        }),
      );
      expect(result.id).toBe('booking-monthly-1');
      expect(notifMock.notifyMonthlyRequestCreated).toHaveBeenCalled();
    });

    it('lève ForbiddenException si le bailleur réserve sa propre annonce', async () => {
      await expect(service.createMonthlyRequest('owner1', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.booking.create).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si le rentalMode n'accepte pas le mensuel", async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        ...monthlyListing,
        rentalMode: RentalMode.NIGHTLY,
      });
      await expect(
        service.createMonthlyRequest('tenant1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("lève BadRequestException si l'annonce n'est pas ACTIVE", async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        ...monthlyListing,
        status: 'SUSPENDED',
      });
      await expect(
        service.createMonthlyRequest('tenant1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si une demande mensuelle est déjà en cours', async () => {
      prismaMock.booking.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.createMonthlyRequest('tenant1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("lève BadRequestException si la date d'entrée chevauche une nuitée réservée", async () => {
      prismaMock.booking.findFirst
        .mockResolvedValueOnce(null) // pas de demande mensuelle en cours
        .mockResolvedValueOnce({ id: 'nightly-overlap' }); // chevauchement nuitée
      await expect(
        service.createMonthlyRequest('tenant1', dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- approveMonthlyRequest / rejectMonthlyRequest ---
  describe('approveMonthlyRequest', () => {
    const requestedBooking = {
      id: 'booking-monthly-1',
      listingId: 'listing1',
      tenantId: 'tenant1',
      bookingType: BookingType.MONTHLY,
      status: BookingStatus.REQUESTED,
      totalAmount: 600000,
      listing: { ...listing, owner, rentalMode: RentalMode.MONTHLY },
      tenant,
    };

    it('approuve si owner et statut REQUESTED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        requestedBooking,
      );
      prismaMock.booking.update.mockResolvedValueOnce({
        ...requestedBooking,
        status: BookingStatus.APPROVED,
      });

      const result = await service.approveMonthlyRequest(
        'booking-monthly-1',
        'owner1',
      );

      expect(result.status).toBe(BookingStatus.APPROVED);
      expect(notifMock.notifyMonthlyRequestApproved).toHaveBeenCalled();
    });

    it("lève ForbiddenException si l'utilisateur n'est pas le propriétaire", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        requestedBooking,
      );
      await expect(
        service.approveMonthlyRequest('booking-monthly-1', 'autre-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le statut n’est pas REQUESTED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...requestedBooking,
        status: BookingStatus.APPROVED,
      });
      await expect(
        service.approveMonthlyRequest('booking-monthly-1', 'owner1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si bookingType n’est pas MONTHLY', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...requestedBooking,
        bookingType: BookingType.NIGHTLY,
      });
      await expect(
        service.approveMonthlyRequest('booking-monthly-1', 'owner1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectMonthlyRequest', () => {
    const requestedBooking = {
      id: 'booking-monthly-1',
      listingId: 'listing1',
      tenantId: 'tenant1',
      bookingType: BookingType.MONTHLY,
      status: BookingStatus.REQUESTED,
      totalAmount: 600000,
      listing: { ...listing, owner, rentalMode: RentalMode.MONTHLY },
      tenant,
    };

    it('refuse si owner et statut REQUESTED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        requestedBooking,
      );
      prismaMock.booking.update.mockResolvedValueOnce({
        ...requestedBooking,
        status: BookingStatus.REJECTED,
      });

      const result = await service.rejectMonthlyRequest(
        'booking-monthly-1',
        'owner1',
      );

      expect(result.status).toBe(BookingStatus.REJECTED);
      expect(notifMock.notifyMonthlyRequestRejected).toHaveBeenCalled();
    });

    it("lève ForbiddenException si l'utilisateur n'est pas le propriétaire", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(
        requestedBooking,
      );
      await expect(
        service.rejectMonthlyRequest('booking-monthly-1', 'autre-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le statut n’est pas REQUESTED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...requestedBooking,
        status: BookingStatus.APPROVED,
      });
      await expect(
        service.rejectMonthlyRequest('booking-monthly-1', 'owner1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- terminateLease ---
  describe('terminateLease', () => {
    const activeBooking = {
      id: 'booking-monthly-1',
      listingId: 'listing1',
      tenantId: 'tenant1',
      bookingType: BookingType.MONTHLY,
      status: BookingStatus.ACTIVE,
      totalAmount: 600000,
      listing: { ...listing, owner, rentalMode: RentalMode.MONTHLY },
      tenant,
    };

    it('résilie le bail si le locataire résilie — repasse l’annonce en ACTIVE', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(activeBooking);
      prismaMock.$transaction.mockResolvedValueOnce([
        { ...activeBooking, status: BookingStatus.TERMINATED },
        { ...listing, status: 'ACTIVE' },
      ]);

      const result = await service.terminateLease('booking-monthly-1', tenant);

      expect(result.status).toBe(BookingStatus.TERMINATED);
      expect(notifMock.notifyLeaseTerminated).toHaveBeenCalledWith(
        expect.objectContaining({ terminatedByTenant: true }),
      );
    });

    it('résilie le bail si le bailleur résilie', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(activeBooking);
      prismaMock.$transaction.mockResolvedValueOnce([
        { ...activeBooking, status: BookingStatus.TERMINATED },
        { ...listing, status: 'ACTIVE' },
      ]);

      const result = await service.terminateLease('booking-monthly-1', owner);

      expect(result.status).toBe(BookingStatus.TERMINATED);
      expect(notifMock.notifyLeaseTerminated).toHaveBeenCalledWith(
        expect.objectContaining({ terminatedByTenant: false }),
      );
    });

    it("lève ForbiddenException si l'utilisateur n'est ni locataire, ni bailleur, ni admin", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(activeBooking);
      const stranger: User = {
        ...tenant,
        id: 'stranger1',
        roles: [Role.LOCATAIRE],
      };
      await expect(
        service.terminateLease('booking-monthly-1', stranger),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si le statut n’est pas ACTIVE', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...activeBooking,
        status: BookingStatus.APPROVED,
      });
      await expect(
        service.terminateLease('booking-monthly-1', tenant),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si bookingType n’est pas MONTHLY', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        ...activeBooking,
        bookingType: BookingType.NIGHTLY,
      });
      await expect(
        service.terminateLease('booking-monthly-1', tenant),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
