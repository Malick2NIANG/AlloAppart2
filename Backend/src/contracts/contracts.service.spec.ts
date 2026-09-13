import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, type User } from '@prisma/client';

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
  agencyAddress: null,
  agencyColor: null,
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
  agencyAddress: null,
  agencyColor: null,
  isVerified: false,
  isSuspended: false,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stranger: User = { ...tenant, id: 'stranger1' };
const admin: User = { ...owner, id: 'admin1', roles: [Role.ADMIN] };

const listing = {
  id: 'listing1',
  ownerId: 'owner1',
  owner,
  title: 'Bel appartement Plateau',
  type: 'APPARTEMENT',
  address: 'Rue 10',
  city: 'Dakar',
  region: 'Dakar',
  rooms: 3,
  surface: 80,
  price: 200000,
  chargesIncluded: true,
  depositMonths: 2,
  minLeaseMonths: 3,
};

const bookingFull = {
  id: 'booking1',
  listingId: 'listing1',
  tenantId: 'tenant1',
  listing,
  tenant,
  startDate: new Date('2026-09-01'),
  totalAmount: 600000,
  platformFee: 200000,
  depositAmount: 400000,
};

const contract = {
  id: 'contract1',
  bookingId: 'booking1',
  type: 'HABITATION' as const,
  pdfUrl: 'https://res.cloudinary.com/x/raw/upload/contrat-draft.pdf',
};

describe('ContractsService', () => {
  let service: ContractsService;
  let prismaMock: {
    contract: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    booking: { findUniqueOrThrow: jest.Mock };
  };
  let pdfMock: { generateLeaseContract: jest.Mock };
  let uploadMock: { uploadPdfBuffer: jest.Mock };
  let notifMock: { notifyContractReady: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      contract: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      booking: { findUniqueOrThrow: jest.fn() },
    };
    pdfMock = {
      generateLeaseContract: jest
        .fn()
        .mockResolvedValue(Buffer.from('%PDF-fake')),
    };
    uploadMock = {
      uploadPdfBuffer: jest.fn().mockResolvedValue({
        url: 'https://res.cloudinary.com/x/raw/upload/f.pdf',
        publicId: 'f',
      }),
    };
    notifMock = {
      notifyContractReady: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: pdfMock },
        { provide: UploadService, useValue: uploadMock },
        { provide: NotificationsService, useValue: notifMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  // --- generateForBooking ---
  describe('generateForBooking', () => {
    it('retourne le contrat existant sans le régénérer (idempotent)', async () => {
      prismaMock.contract.findUnique.mockResolvedValueOnce(contract);

      const result = await service.generateForBooking('booking1');

      expect(result).toEqual(contract);
      expect(pdfMock.generateLeaseContract).not.toHaveBeenCalled();
      expect(uploadMock.uploadPdfBuffer).not.toHaveBeenCalled();
    });

    it('génère le PDF, le téléverse et crée le contrat', async () => {
      prismaMock.contract.findUnique.mockResolvedValueOnce(null);
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce(bookingFull);
      prismaMock.contract.create.mockResolvedValueOnce(contract);

      const result = await service.generateForBooking('booking1');

      expect(pdfMock.generateLeaseContract).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking1',
          monthlyRent: 200000,
          depositAmount: 400000,
          depositMonths: 2,
          minLeaseMonths: 3,
          totalDueAtSigning: 600000,
          platformFee: 200000,
        }),
        // QR de vérification d'identité locataire (incrusté dans le PDF) —
        // généré à la volée, on vérifie juste qu'un buffer a bien été passé.
        expect.any(Buffer),
      );
      expect(uploadMock.uploadPdfBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('booking1'),
      );
      expect(prismaMock.contract.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          bookingId: 'booking1',
          type: 'HABITATION',
          pdfUrl: 'https://res.cloudinary.com/x/raw/upload/f.pdf',
        }),
      });
      expect(notifMock.notifyContractReady).toHaveBeenCalled();
      expect(result).toEqual(contract);
    });
  });

  // --- findByBooking ---
  describe('findByBooking', () => {
    it('retourne le contrat si le locataire consulte', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        tenantId: 'tenant1',
        listing: { ownerId: 'owner1' },
      });
      prismaMock.contract.findUnique.mockResolvedValueOnce(contract);

      const result = await service.findByBooking('booking1', tenant);
      expect(result).toEqual(contract);
    });

    it('retourne le contrat si le bailleur consulte', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        tenantId: 'tenant1',
        listing: { ownerId: 'owner1' },
      });
      prismaMock.contract.findUnique.mockResolvedValueOnce(contract);

      const result = await service.findByBooking('booking1', owner);
      expect(result).toEqual(contract);
    });

    it('retourne null si aucun contrat encore généré', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        tenantId: 'tenant1',
        listing: { ownerId: 'owner1' },
      });
      prismaMock.contract.findUnique.mockResolvedValueOnce(null);

      const result = await service.findByBooking('booking1', tenant);
      expect(result).toBeNull();
    });

    it('autorise un ADMIN même sans être partie prenante', async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        tenantId: 'tenant1',
        listing: { ownerId: 'owner1' },
      });
      prismaMock.contract.findUnique.mockResolvedValueOnce(contract);

      const result = await service.findByBooking('booking1', admin);
      expect(result).toEqual(contract);
    });

    it("lève ForbiddenException si l'utilisateur n'est ni locataire, ni bailleur, ni admin", async () => {
      prismaMock.booking.findUniqueOrThrow.mockResolvedValueOnce({
        tenantId: 'tenant1',
        listing: { ownerId: 'owner1' },
      });

      await expect(service.findByBooking('booking1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.contract.findUnique).not.toHaveBeenCalled();
    });
  });
});
