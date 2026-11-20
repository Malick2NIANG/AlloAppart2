import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPublicPricing, formatFcfa } from './pricing';

describe('fetchPublicPricing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renvoie les valeurs telles que fournies par /tarifs (venant de la config)', async () => {
    const payload = {
      starterPriceFcfa: 75000,
      proPriceFcfaMonthly: 150000,
      nightlyCommissionRate: 0.1,
      monthlyCommissionMonths: 1,
      auditBasicPriceFcfa: 25000,
      boostPriceFcfa: 5000,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    }));
    await expect(fetchPublicPricing()).resolves.toEqual(payload);
  });

  it('renvoie null si la réponse HTTP est en erreur (repli)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    await expect(fetchPublicPricing()).resolves.toBeNull();
  });

  it('renvoie null si fetch rejette (endpoint indisponible, repli)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchPublicPricing()).resolves.toBeNull();
  });
});

describe('formatFcfa', () => {
  it('formate en fr-FR par défaut', () => {
    // Espace insécable U+00A0 ou U+202F selon la version de Node/ICU — même
    // gotcha que utils.test.ts (formatPrice).
    expect(formatFcfa(150000, 'fr').replace(/[  ]/g, ' ')).toBe('150 000');
  });

  it('formate en en-US pour la locale anglaise', () => {
    expect(formatFcfa(150000, 'en')).toBe('150,000');
  });
});
