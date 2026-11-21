import type { ListingType } from '@prisma/client';

/**
 * Libellés officiels — copiés tels quels depuis Frontend/src/messages/*.json
 * (clés typeXxx / amenityXxx) pour que le texte généré n'emploie jamais un
 * mot différent de celui déjà affiché à l'utilisateur ailleurs sur le site.
 * Pas d'import cross-projet possible (Backend n'a pas accès à next-intl) :
 * copie volontaire, à resynchroniser si ces libellés changent côté Frontend.
 */
export const TYPE_LABEL_FR: Record<ListingType, string> = {
  APPARTEMENT: 'appartement',
  VILLA: 'villa',
  STUDIO: 'studio',
  CHAMBRE: 'chambre',
  BUREAU: 'bureau',
  TERRAIN: 'terrain',
  MAISON: 'maison',
  LOCAL_COMMERCIAL: 'local commercial',
};

export const TYPE_LABEL_EN: Record<ListingType, string> = {
  APPARTEMENT: 'apartment',
  VILLA: 'villa',
  STUDIO: 'studio',
  CHAMBRE: 'room',
  BUREAU: 'office',
  TERRAIN: 'plot of land',
  MAISON: 'house',
  LOCAL_COMMERCIAL: 'commercial space',
};

/** « ce »/« cet »/« cette » devant le nom du type (minuscule, milieu de phrase). */
export const TYPE_DEM_FR: Record<ListingType, string> = {
  APPARTEMENT: 'cet',
  VILLA: 'cette',
  STUDIO: 'ce',
  CHAMBRE: 'cette',
  BUREAU: 'ce',
  TERRAIN: 'ce',
  MAISON: 'cette',
  LOCAL_COMMERCIAL: 'ce',
};

/** Pronom de reprise (« il »/« elle ») selon le genre du type en français. */
export const TYPE_PRONOUN_FR: Record<ListingType, string> = {
  APPARTEMENT: 'il',
  VILLA: 'elle',
  STUDIO: 'il',
  CHAMBRE: 'elle',
  BUREAU: 'il',
  TERRAIN: 'il',
  MAISON: 'elle',
  LOCAL_COMMERCIAL: 'il',
};

/** Clé d'équipement (cf. Frontend/src/lib/listingProfile.ts) → libellé officiel. */
export const AMENITY_LABEL_FR: Record<string, string> = {
  wifi: 'Wi-Fi',
  clim: 'Climatisation',
  tv: 'Télévision',
  cuisine: 'Cuisine équipée',
  douche: 'Douche / SdB',
  gardien: 'Gardiennage',
  parking: 'Parking',
  piscine: 'Piscine',
  balcon: 'Balcon / Terrasse',
  generateur: 'Générateur',
  viabilise: 'Terrain viabilisé',
  eau: 'Eau courante',
  electricite: 'Électricité',
  titre_foncier: 'Titre foncier',
  cloture: 'Clôturé',
  acces_route: 'Accès route',
};

export const AMENITY_LABEL_EN: Record<string, string> = {
  wifi: 'Wi-Fi',
  clim: 'Air conditioning',
  tv: 'Television',
  cuisine: 'Fitted kitchen',
  douche: 'Shower / Bathroom',
  gardien: 'Security guard',
  parking: 'Parking',
  piscine: 'Swimming pool',
  balcon: 'Balcony / Terrace',
  generateur: 'Generator',
  viabilise: 'Serviced plot',
  eau: 'Running water',
  electricite: 'Electricity',
  titre_foncier: 'Land title',
  cloture: 'Fenced',
  acces_route: 'Road access',
};

/** Ordre d'affichage canonique — identique à Frontend/.../publier/page.tsx. */
export const AMENITY_ORDER: readonly string[] = [
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
];

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Sépare les milliers par un espace simple — "150000" → "150 000". */
export function formatAmount(n: number): string {
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function joinList(items: string[], and: string): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}
