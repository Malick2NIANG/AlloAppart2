import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, EscrowStatus } from '@prisma/client';
import { createHmac } from 'crypto';

const TEST_SECRET = 'test-cinetpay-secret';
const SITE_ID = 'site123';
const TRANS_ID = 'AA-booking1-1234567890';

function nowCinetPay(): string {
  const d = new Date();
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    String(d.getUTCHours()).padStart(2, '0') +
    String(d.getUTCMinutes()).padStart(2, '0') +
    String(d.getUTCSeconds()).padStart(2, '0')
  );
}

function hoursAgoCinetPay(hours: number): string {
  const d = new Date(Date.now() - hours * 3600 * 1000);
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    String(d.getUTCHours()).padStart(2, '0') +
    String(d.getUTCMinutes()).padStart(2, '0') +
    String(d.getUTCSeconds()).padStart(2, '0')
  );
}

function sign(siteId: string, transId: string, transDate: string): string {
  return createHmac('sha256', TEST_SECRET)
    .update(siteId + transId + transDate)
    .digest('hex');
}

function validPayload(overrides: Record<string, string> = {}) {
  const date = overrides.cpm_trans_date ?? nowCinetPay();
  return {
    cpm_site_id: SITE_ID,
    cpm_trans_id: TRANS_ID,
    cpm_trans_date: date,
    cpm_amount: '50000',
    cpm_currency: 'XOF',
    cpm_result: '00',
    signature: sign(SITE_ID, TRANS_ID, date),
    payment_method: 'MOBILE_MONEY',
    ...overrides,
  };
}

describe('PaymentsService — handleWebhook', () => {
  let service: PaymentsService;
  let prismaMock: { booking: { findFirst: jest.Mock; update: jest.Mock } };

  // totalAmount doit être un nombre brut pour que Number() fonctionne correctement
  const pendingBooking = {
    id: 'booking1',
    paymentRef: TRANS_ID,
    status: BookingStatus.PENDING,
    escrowStatus: EscrowStatus.AWAITING_PAYMENT,
    totalAmount: 50000 as unknown as import('@prisma/client').Prisma.Decimal,
  };

  beforeEach(async () => {
    prismaMock = {
      booking: {
        findFirst: jest.fn().mockResolvedValue(pendingBooking),
        update: jest.fn().mockResolvedValue({
          ...pendingBooking,
          status: BookingStatus.CONFIRMED,
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'CINETPAY_SECRET_KEY') return TEST_SECRET;
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              if (key === 'BACKEND_URL') return 'http://localhost:4000';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => jest.restoreAllMocks());

  // --- HMAC ---
  it('accepte un webhook avec signature valide', async () => {
    const result = await service.handleWebhook(validPayload() as any);
    expect(result).toEqual({ ok: true });
  });

  it('rejette une signature invalide', async () => {
    const payload = validPayload({ signature: 'aabbccddeeff' + '00'.repeat(26) });
    await expect(service.handleWebhook(payload as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejette une signature vide', async () => {
    const payload = validPayload({ signature: '' });
    await expect(service.handleWebhook(payload as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  // --- Fenêtre replay ---
  it('rejette un webhook vieux de plus de 1 heure', async () => {
    const oldDate = hoursAgoCinetPay(2);
    const payload = validPayload({
      cpm_trans_date: oldDate,
      signature: sign(SITE_ID, TRANS_ID, oldDate),
    });
    await expect(service.handleWebhook(payload as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejette un horodatage invalide', async () => {
    const payload = validPayload({
      cpm_trans_date: 'invalid',
      signature: sign(SITE_ID, TRANS_ID, 'invalid'),
    });
    await expect(service.handleWebhook(payload as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepte un webhook récent (dans la fenêtre)', async () => {
    const recentDate = hoursAgoCinetPay(0);
    const payload = validPayload({
      cpm_trans_date: recentDate,
      signature: sign(SITE_ID, TRANS_ID, recentDate),
    });
    await expect(service.handleWebhook(payload as any)).resolves.toEqual({
      ok: true,
    });
  });

  // --- Booking introuvable ---
  it('retourne ok si aucun booking trouvé', async () => {
    prismaMock.booking.findFirst.mockResolvedValueOnce(null);
    const result = await service.handleWebhook(validPayload() as any);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  // --- Idempotence ---
  it('retourne ok sans re-traitement si booking déjà CONFIRMED', async () => {
    prismaMock.booking.findFirst.mockResolvedValueOnce({
      ...pendingBooking,
      status: BookingStatus.CONFIRMED,
    });
    const result = await service.handleWebhook(validPayload() as any);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it('retourne ok sans re-traitement si booking déjà COMPLETED', async () => {
    prismaMock.booking.findFirst.mockResolvedValueOnce({
      ...pendingBooking,
      status: BookingStatus.COMPLETED,
    });
    const result = await service.handleWebhook(validPayload() as any);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  // --- Vérification montant ---
  it('rejette si le montant payé ne correspond pas', async () => {
    const payload = validPayload({ cpm_amount: '1' });
    await expect(service.handleWebhook(payload as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepte une différence de 1 XOF (tolérance arrondis)', async () => {
    const payload = validPayload({ cpm_amount: '50001' });
    await expect(service.handleWebhook(payload as any)).resolves.toEqual({
      ok: true,
    });
  });

  // --- Succès / Échec paiement ---
  it('passe le booking en CONFIRMED + HELD sur cpm_result=00', async () => {
    await service.handleWebhook(validPayload({ cpm_result: '00' }) as any);
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          escrowStatus: EscrowStatus.HELD,
        }),
      }),
    );
  });

  it('passe le booking en CANCELLED + REFUNDED sur cpm_result non-00', async () => {
    await service.handleWebhook(validPayload({ cpm_result: 'XX' }) as any);
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          escrowStatus: EscrowStatus.REFUNDED,
        }),
      }),
    );
  });

  // --- Secret manquant ---
  it('rejette si CINETPAY_SECRET_KEY absent', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    const svc = mod.get<PaymentsService>(PaymentsService);
    await expect(svc.handleWebhook(validPayload() as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
