import { describe, expect, it } from 'vitest';
import { isImmersiveRoute } from './isImmersiveRoute';

describe('isImmersiveRoute', () => {
  it('détecte le formulaire de publication', () => {
    expect(isImmersiveRoute('/publier')).toBe(true);
  });

  it('détecte une fiche annonce publique', () => {
    expect(isImmersiveRoute('/listings/5ae8da31-5ce8-486a-9786-9c5bd1d459b8')).toBe(true);
  });

  it("ne détecte pas la liste d'annonces elle-même", () => {
    expect(isImmersiveRoute('/listings')).toBe(false);
    expect(isImmersiveRoute('/listings/')).toBe(false);
  });

  it("détecte l'édition d'annonce bailleur", () => {
    expect(isImmersiveRoute('/bailleur/listings/5ae8da31-5ce8-486a-9786-9c5bd1d459b8/edit')).toBe(true);
  });

  it("ne détecte pas la liste des annonces bailleur", () => {
    expect(isImmersiveRoute('/bailleur/listings')).toBe(false);
  });

  it.each([
    '/locataire/messages/room-1',
    '/bailleur/messages/room-1',
    '/agent/messages/room-1',
  ])('détecte une conversation ouverte (%s)', (pathname) => {
    expect(isImmersiveRoute(pathname)).toBe(true);
  });

  it.each([
    '/locataire/messages',
    '/bailleur/messages',
    '/agent/messages',
    '/messages',
  ])("ne détecte pas la liste des conversations (%s)", (pathname) => {
    expect(isImmersiveRoute(pathname)).toBe(false);
  });

  it('ne détecte pas les autres pages publiques', () => {
    expect(isImmersiveRoute('/')).toBe(false);
    expect(isImmersiveRoute('/agences')).toBe(false);
    expect(isImmersiveRoute('/sign-in')).toBe(false);
  });
});
