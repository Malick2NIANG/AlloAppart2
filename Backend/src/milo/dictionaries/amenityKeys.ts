/**
 * Clés canoniques d'équipements — copie exacte de l'union des clés
 * utilisées dans Frontend/src/lib/listingProfile.ts (HOME_AMENITIES +
 * clés spécifiques BUREAU/LOCAL_COMMERCIAL/TERRAIN), seule source de
 * vérité du produit pour ces clés. Dupliquée ici car le Backend ne peut
 * pas importer du code Frontend. À resynchroniser manuellement si
 * `listingProfile.ts` change — aucune clé ne doit être inventée côté Milo
 * (ex. "meublé"/"furnished" n'existe pas dans listingProfile.ts : non
 * repris ici, signalé dans le rapport du lot 1b).
 */
export const AMENITY_KEYS = [
  'wifi',
  'clim',
  'tv',
  'cuisine',
  'douche',
  'gardien',
  'parking',
  'piscine',
  'balcon',
  'generateur',
  'viabilise',
  'eau',
  'electricite',
  'titre_foncier',
  'cloture',
  'acces_route',
] as const;

export type AmenityKey = (typeof AMENITY_KEYS)[number];
