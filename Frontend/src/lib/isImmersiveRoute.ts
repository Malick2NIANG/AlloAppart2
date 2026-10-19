/**
 * Routes "immersives" (fiche annonce, steppers, conversation ouverte) : la
 * BottomNav y est masquée, la barre de contact/actions déjà en place sur la
 * page (ex. ListingContactCard) reste seule maîtresse du bas d'écran — cf.
 * décision validée du chantier mobile (AUDIT_MOBILE.md, « Décisions
 * validées », point 1).
 */
export function isImmersiveRoute(pathname: string): boolean {
  if (pathname === '/publier') return true;
  if (/^\/listings\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/bailleur\/listings\/[^/]+\/edit\/?$/.test(pathname)) return true;
  if (/\/messages\/[^/]+\/?$/.test(pathname)) return true;
  return false;
}
