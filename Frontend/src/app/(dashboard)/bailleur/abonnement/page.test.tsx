import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, within, waitFor, cleanup } from '@testing-library/react';
import AbonnementPage from './page';
import TarifsContent from '../../../(public)/tarifs/TarifsContent';
import type { PublicPricing } from '@/lib/pricing';

// Lot « prix en dur » : /bailleur/abonnement et /tarifs doivent afficher
// EXACTEMENT les mêmes montants Starter/Pro, lus depuis la même source
// (fetchPublicPricing / @/lib/pricing), jamais l'un en dur et l'autre en
// config — voir aussi TarifsContent.test.tsx et src/lib/pricing.test.ts.
const PRICING: PublicPricing = {
  starterPriceFcfa: 75000,
  proPriceFcfaMonthly: 150000,
  nightlyCommissionRate: 0.1,
  monthlyCommissionMonths: 1,
  auditBasicPriceFcfa: 25000,
  boostPriceFcfa: 5000,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${ns}.${key}(${JSON.stringify(vars)})` : `${ns}.${key}`,
  useLocale: () => 'fr',
}));

// Référence stable (comme le vrai Clerk) — cf. MessagesShell.test.tsx.
const getToken = vi.fn().mockResolvedValue('fake-token');
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('/bailleur/abonnement vs /tarifs — même source de tarification', () => {
  it('affiche des montants Starter/Pro identiques, formatés de la même façon', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/tarifs')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRICING) });
      }
      // /auth/me, /subscriptions/me : aucun abonnement actif pour ce test,
      // seuls les prix affichés nous intéressent ici.
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }));

    const tarifs = render(<TarifsContent pricing={PRICING} />);
    const abonnement = render(<AbonnementPage />);

    await waitFor(() => within(abonnement.container).getByText('75 000'));

    expect(within(abonnement.container).getByText('75 000').textContent)
      .toBe(within(tarifs.container).getByText('75 000').textContent);
    expect(within(abonnement.container).getByText('150 000').textContent)
      .toBe(within(tarifs.container).getByText('150 000').textContent);
  });
});
