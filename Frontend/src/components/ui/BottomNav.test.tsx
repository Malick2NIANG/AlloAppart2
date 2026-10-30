import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BottomNav from './BottomNav';
import type { BottomNavItem } from '@/lib/getBottomNavItems';

let pathname = '/locataire';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Items réels de l'espace locataire (cf. getBottomNavItems.ts) : overview
// (/locataire) est la « racine » d'un autre onglet (bookings), donc ne doit
// s'activer que sur son chemin exact (lot « onglet actif de la barre du bas »).
const LOCATAIRE_ITEMS: BottomNavItem[] = [
  { key: 'overview', href: '/locataire', icon: 'fa-solid fa-gauge', i18nNamespace: 'dashboard', labelKey: 'navOverview' },
  { key: 'bookings', href: '/locataire/bookings', icon: 'fa-solid fa-calendar-check', i18nNamespace: 'dashboard', labelKey: 'navMyBookings' },
  { key: 'messages', href: '/locataire/messages', icon: 'fa-solid fa-comment-dots', i18nNamespace: 'dashboard', labelKey: 'navMessages' },
];

function activeLabels() {
  return screen.getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
}

describe('BottomNav — onglet actif (racine vs sous-page)', () => {
  it('/locataire/bookings : seul « navMyBookings » actif, pas « navOverview »', () => {
    pathname = '/locataire/bookings';
    render(<BottomNav items={LOCATAIRE_ITEMS} />);
    expect(activeLabels()).toEqual(['navMyBookings']);
  });

  it('/locataire/favorites : aucun onglet actif (page hors barre, accessible via « Plus »)', () => {
    pathname = '/locataire/favorites';
    render(<BottomNav items={LOCATAIRE_ITEMS} />);
    expect(activeLabels()).toEqual([]);
  });

  it('/locataire : « navOverview » actif (chemin exact de la racine)', () => {
    pathname = '/locataire';
    render(<BottomNav items={LOCATAIRE_ITEMS} />);
    expect(activeLabels()).toEqual(['navOverview']);
  });
});
