import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ListingContactCard from './ListingContactCard';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/listings/abc123',
}));

const getToken = vi.fn().mockResolvedValue('token-123');
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken }),
  useUser: () => ({ isSignedIn: false }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ favorited: false }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const BASE_PROPS = {
  listingId: 'abc123',
  landlordName: 'Fatou Diop',
  priceEntries: [{ amount: 150000, unit: 'month' as const }],
  numLocale: 'fr',
};

describe('ListingContactCard — barre de contact mobile (lot « recette » : bannière cookies)', () => {
  it("décale la barre au-dessus de la bannière cookies via --cookie-banner-h (jamais en-dessous)", () => {
    const { container } = render(<ListingContactCard {...BASE_PROPS} />);
    const bar = container.querySelector('.z-70');
    expect(bar).not.toBeNull();
    // La classe Tailwind arbitraire encode le calc() complet — on vérifie que
    // la variable posée par CookieConsentBanner (0px tant qu'elle n'est pas
    // affichée) y est bien additionnée, en plus de --bottom-offset existant.
    expect(bar?.className).toContain('--cookie-banner-h');
    expect(bar?.className).toContain('--bottom-offset');
  });

  it('ne rend aucune barre de contact mobile pour le propriétaire (rien à décaler)', () => {
    const { container } = render(<ListingContactCard {...BASE_PROPS} isOwner />);
    expect(container.querySelector('.z-70')).toBeNull();
  });
});
