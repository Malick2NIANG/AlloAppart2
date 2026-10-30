import { describe, expect, it } from 'vitest';
import { getBottomNavItems } from './getBottomNavItems';

describe('getBottomNavItems', () => {
  it('visiteur non connecté : 5 items publics, Messages/Compte vers /sign-in', () => {
    const r = getBottomNavItems([], false);
    expect(r.context).toBe('PUBLIC');
    expect(r.showMore).toBe(false);
    expect(r.items).toHaveLength(5);
    expect(r.items.map((i) => i.key)).toEqual(['home', 'listings', 'favorites', 'messages', 'account']);
    expect(r.items.find((i) => i.key === 'messages')?.href).toBe('/sign-in');
    expect(r.items.find((i) => i.key === 'account')?.href).toBe('/sign-in');
  });

  it('connecté sans rôle dédié (public) : Messages/Compte vers les vraies pages', () => {
    const r = getBottomNavItems([], true);
    expect(r.context).toBe('PUBLIC');
    expect(r.items.find((i) => i.key === 'messages')?.href).toBe('/messages');
    expect(r.items.find((i) => i.key === 'account')?.href).toBe('/profil');
  });

  it('connecté (public) : « Mon espace » remplace « Favoris », toujours 5 items', () => {
    const r = getBottomNavItems([], true);
    expect(r.items).toHaveLength(5);
    expect(r.items.map((i) => i.key)).toEqual(['home', 'listings', 'space', 'messages', 'account']);
    expect(r.items.find((i) => i.key === 'space')?.href).toBe('/redirect');
    expect(r.items.some((i) => i.key === 'favorites')).toBe(false);
  });

  it('locataire seul : 3 items + Plus (Favoris dans le menu)', () => {
    const r = getBottomNavItems(['LOCATAIRE'], true);
    expect(r.context).toBe('LOCATAIRE');
    expect(r.showMore).toBe(true);
    expect(r.items).toHaveLength(3);
    expect(r.items.map((i) => i.href)).toEqual([
      '/locataire', '/locataire/bookings', '/locataire/messages',
    ]);
  });

  it('bailleur seul : 4 items, Plus visible', () => {
    const r = getBottomNavItems(['BAILLEUR'], true);
    expect(r.context).toBe('BAILLEUR');
    expect(r.showMore).toBe(true);
    expect(r.items.map((i) => i.href)).toEqual([
      '/bailleur', '/bailleur/listings', '/bailleur/bookings', '/bailleur/messages',
    ]);
  });

  it('agence PRO (PRO_AGENCE) traitée comme bailleur', () => {
    const r = getBottomNavItems(['PRO_AGENCE'], true);
    expect(r.context).toBe('BAILLEUR');
  });

  it('compte double locataire+bailleur : contexte DUAL, ordre spécifique', () => {
    const r = getBottomNavItems(['LOCATAIRE', 'BAILLEUR'], true);
    expect(r.context).toBe('DUAL');
    expect(r.showMore).toBe(true);
    expect(r.items.map((i) => i.href)).toEqual([
      '/bailleur', '/bailleur/listings', '/bailleur/messages', '/bailleur/bookings',
    ]);
  });

  it('agent terrain : 4 items, Plus masqué (tout y tient déjà)', () => {
    const r = getBottomNavItems(['AGENT_TERRAIN'], true);
    expect(r.context).toBe('AGENT');
    expect(r.showMore).toBe(false);
    expect(r.items.map((i) => i.href)).toEqual([
      '/agent', '/agent/verifications', '/agent/messages', '/agent/profil',
    ]);
  });

  it('admin : 4 items, Plus visible', () => {
    const r = getBottomNavItems(['ADMIN'], true);
    expect(r.context).toBe('ADMIN');
    expect(r.showMore).toBe(true);
    expect(r.items.map((i) => i.href)).toEqual([
      '/espace', '/espace/users', '/espace/listings', '/espace/verifications',
    ]);
  });

  it('admin prioritaire même cumulé avec un autre rôle', () => {
    const r = getBottomNavItems(['ADMIN', 'LOCATAIRE'], true);
    expect(r.context).toBe('ADMIN');
  });

  it('agent prioritaire sur bailleur/locataire (mais pas sur admin)', () => {
    expect(getBottomNavItems(['AGENT_TERRAIN', 'LOCATAIRE'], true).context).toBe('AGENT');
    expect(getBottomNavItems(['ADMIN', 'AGENT_TERRAIN'], true).context).toBe('ADMIN');
  });

  it('chaque item a une clé i18n et un namespace', () => {
    const r = getBottomNavItems(['BAILLEUR'], true);
    for (const item of r.items) {
      expect(item.i18nNamespace).toMatch(/^(nav|dashboard)$/);
      expect(item.labelKey.length).toBeGreaterThan(0);
    }
  });
});
