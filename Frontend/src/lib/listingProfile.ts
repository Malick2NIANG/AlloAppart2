/**
 * Quelles caractéristiques ont un sens selon le type de bien — un terrain n'a
 * ni pièces, ni chambres, ni salles de bain ; un bureau n'a pas de lits, etc.
 * Source unique pour les formulaires (publier / modifier), le récapitulatif
 * et l'affichage public : ne pas dupliquer ces règles ailleurs.
 */

export type ListingTypeKey =
  | 'APPARTEMENT'
  | 'VILLA'
  | 'STUDIO'
  | 'CHAMBRE'
  | 'BUREAU'
  | 'TERRAIN'
  | 'MAISON'
  | 'LOCAL_COMMERCIAL';

export interface ListingProfile {
  /** Champ « Pièces » pertinent. */
  rooms: boolean;
  /** Champ « Chambres / lits » pertinent. */
  beds: boolean;
  /** Champ « Salles de bain » pertinent. */
  baths: boolean;
  /** La superficie est obligatoire (terrain). */
  surfaceRequired: boolean;
  /** Clés d'équipements proposées, dans l'ordre d'affichage. */
  amenities: readonly string[];
}

const HOME_AMENITIES = [
  'wifi', 'clim', 'tv', 'cuisine', 'douche', 'gardien', 'parking', 'piscine', 'balcon', 'generateur',
] as const;

const PROFILES: Record<ListingTypeKey, ListingProfile> = {
  APPARTEMENT: { rooms: true, beds: true, baths: true, surfaceRequired: false, amenities: HOME_AMENITIES },
  VILLA: { rooms: true, beds: true, baths: true, surfaceRequired: false, amenities: HOME_AMENITIES },
  MAISON: { rooms: true, beds: true, baths: true, surfaceRequired: false, amenities: HOME_AMENITIES },
  STUDIO: { rooms: false, beds: true, baths: true, surfaceRequired: false, amenities: HOME_AMENITIES },
  CHAMBRE: { rooms: false, beds: true, baths: true, surfaceRequired: false, amenities: HOME_AMENITIES },
  BUREAU: {
    rooms: true, beds: false, baths: true, surfaceRequired: false,
    amenities: ['wifi', 'clim', 'parking', 'gardien', 'generateur', 'cuisine'],
  },
  LOCAL_COMMERCIAL: {
    rooms: false, beds: false, baths: true, surfaceRequired: false,
    amenities: ['clim', 'parking', 'gardien', 'generateur', 'wifi'],
  },
  TERRAIN: {
    rooms: false, beds: false, baths: false, surfaceRequired: true,
    amenities: ['viabilise', 'eau', 'electricite', 'titre_foncier', 'cloture', 'acces_route'],
  },
};

export function getListingProfile(type: string | undefined | null): ListingProfile {
  return PROFILES[(type ?? 'APPARTEMENT') as ListingTypeKey] ?? PROFILES.APPARTEMENT;
}

/** Icônes des équipements propres aux terrains (les autres sont déjà connus des pages). */
export const TERRAIN_AMENITY_ICONS: Record<string, string> = {
  viabilise: 'fa-road',
  eau: 'fa-faucet-drip',
  electricite: 'fa-plug',
  titre_foncier: 'fa-file-signature',
  cloture: 'fa-border-all',
  acces_route: 'fa-route',
};

/**
 * Retire les valeurs qui n'ont plus de sens pour ce type (ex. on passe de
 * « Maison » à « Terrain » : les pièces/chambres/salles de bain déjà saisies
 * ne doivent pas être envoyées) et filtre les équipements non proposés.
 */
export function sanitizeForType<
  T extends { type?: string; rooms?: number; beds?: number; baths?: number; amenities?: string[] },
>(values: T): T {
  const profile = getListingProfile(values.type);
  return {
    ...values,
    rooms: profile.rooms ? values.rooms : undefined,
    beds: profile.beds ? values.beds : undefined,
    baths: profile.baths ? values.baths : undefined,
    amenities: (values.amenities ?? []).filter((a) => profile.amenities.includes(a)),
  };
}
