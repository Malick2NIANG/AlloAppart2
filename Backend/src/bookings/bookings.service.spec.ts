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

    it("annule et libere l'escrow si statut HELD", async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        ...pendingBooking,
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
  });
});
