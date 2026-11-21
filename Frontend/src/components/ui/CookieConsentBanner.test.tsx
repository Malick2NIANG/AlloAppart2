import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CookieConsentBanner from './CookieConsentBanner';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// jsdom ne fait jamais varier offsetHeight tout seul — on le fixe explicitement
// pour vérifier que la bannière reporte bien SA hauteur réelle, pas 0.
function stubOffsetHeight(px: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: px,
  });
}

// jsdom n'implémente pas ResizeObserver — stub minimal (pas de callback sur
// resize réel, inutile ici : on vérifie seulement la mesure initiale).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

describe('CookieConsentBanner — pose/retire --cookie-banner-h (lot « recette »)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubOffsetHeight(72);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--cookie-banner-h');
  });

  it('pose --cookie-banner-h sur <html> à sa hauteur réelle tant que la bannière est affichée', async () => {
    render(<CookieConsentBanner />);
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('72px'),
    );
  });

  it("retire --cookie-banner-h une fois la bannière acceptée (la barre en dessous reprend sa position normale)", async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner />);
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('72px'),
    );

    await user.click(document.querySelector('button')!);

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe(''),
    );
  });

  it("ne s'affiche pas si déjà acceptée (localStorage) — aucune variable posée", () => {
    window.localStorage.setItem('aa_cookie_consent', '1');
    render(<CookieConsentBanner />);
    expect(document.documentElement.style.getPropertyValue('--cookie-banner-h')).toBe('');
  });
});
