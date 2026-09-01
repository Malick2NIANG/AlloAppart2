import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingStatus, EscrowStatus, Role, type User } from '@prisma/client';

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
  bio: null,
  avatar: null,
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
  bio: null,
  avatar: null,
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
    listing: { findUniqueOrThrow: jest.Mock };
    booking: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
  };
  let notifMock: {
    notifyBookingCreated: jest.Mock;
    notifyBookingConfirmed: jest.Mock;
    notifyBookingCancelled: jest.Mock;
    notifyDisputeReported: jest.Mock;
    notifyDisputeResolved: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      listing: { findUniqueOrThrow: jest.fn() },
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
    };

    notifMock = {
      notifyBookingCreated: jest.fn().mockResolvedValue(undefined),
      notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined),
      notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
      notifyDisputeReported: jest.fn().mockResolvedValue(undefined),
      notifyDisputeResolved: jest.fn().mockResolvedValue(undefined),
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
    it('calcule totalAmount cote serveur (1 mois)', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 200000,
        title: 'Appart Plateau',
        city: 'Dakar',
        owner,
      });
      prismaMock.booking.create.mockResolvedValueOnce({
        ...pendingBooking,
        totalAmount: 200000,
      });

      await service.create('tenant1', {
        listingId: 'listing1',
        startDate: '2026-07-01',
        endDate: '2026-08-01',
      });

      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ totalAmount: 200000 }),
        }),
      );
    });

    it('calcule totalAmount sur plusieurs mois', async () => {
      prismaMock.listing.findUniqueOrThrow.mockResolvedValueOnce({
        price: 100000,
        title: 'Studio',
        city: 'Thies',
        owner,
      });
      prismaMock.booking.create.mockResolvedValueOnce({
        ...pendingBooking,
        totalAmount: 300000,
      });

      await service.create('tenant1', {
        listingId: 'listing1',
        startDate: '2026-07-01',
        endDate: '2026-10-01',
      });

      expect(prismaMock.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ totalAmount: 300000 }),
        }),
      );
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
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(pendingBooking);
      const result = await service.confirm('booking1', 'owner1');
      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it("leve ForbiddenException si l'utilisateur n'est pas l'owner", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(pendingBooking);
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
        data: { status: BookingStatus.COMPLETED, escrowStatus: EscrowStatus.RELEASED },
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

    it('signale une non-conformité dans la fenêtre de 24h et gèle l\'escrow', async () => {
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

    it('lève ForbiddenException si le caller n\'est pas ADMIN', async () => {
      await expect(
        service.resolveDispute('booking1', tenant, { decision: 'RELEASE' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.booking.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('RELEASE : passe la réservation en COMPLETED / escrow RELEASED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(disputedBooking);
      prismaMock.booking.update.mockResolvedValueOnce({
        ...disputedBooking,
        status: BookingStatus.COMPLETED,
        escrowStatus: EscrowStatus.RELEASED,
      });

      const result = await service.resolveDispute('booking1', admin, { decision: 'RELEASE' });

      expect(result.status).toBe(BookingStatus.COMPLETED);
      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(notifMock.notifyDisputeResolved).toHaveBeenCalled();
    });

    it('REFUND : passe la réservation en CANCELLED / escrow REFUNDED', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(disputedBooking);
      prismaMock.booking.update.mockResolvedValueOnce({
        ...disputedBooking,
        status: BookingStatus.CANCELLED,
        escrowStatus: EscrowStatus.REFUNDED,
      });

      const result = await service.resolveDispute('booking1', admin, { decision: 'REFUND' });

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
});
