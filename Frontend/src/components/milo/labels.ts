/**
 * Milo Search v0 — lot 5b (PLAN_SEARCH_V0.md § 2.d) : libellés de la réponse
 * de Milo (pastilles, bandeau « Milo a compris », messages), affichés dans
 * `detectedLanguage` — INDÉPENDAMMENT de la langue du site (next-intl). Ne
 * pas fusionner avec fr.json/en.json : ce sont deux langues différentes qui
 * peuvent diverger (ex. site en EN, requête tapée en FR → réponse en FR).
 */
import type { DetectedLanguage } from './types';

export type MiloUiLocale = 'fr' | 'en';

interface MiloLabels {
  understoodPrefix: string;
  unmatchedPrefix: string;
  rephrase: string;
  notUnderstood: string;
  emptyResultsWithCriteria: string;
  unsupportedNotice: (siteLocaleName: string) => string;
  categories: {
    region: string;
    cityContains: string;
    minBeds: string;
    maxBeds: string;
    minRooms: string;
    maxRooms: string;
  };
  amenities: Record<string, string>;
  /** Nombre exact (minBeds === maxBeds) : pluriel correct, sans « min./max. ». */
  bedsExact: (n: number) => string;
  roomsExact: (n: number) => string;
}

const FR: MiloLabels = {
  understoodPrefix: 'Milo a compris :',
  unmatchedPrefix: 'Mots non compris :',
  rephrase: 'Reformuler',
  notUnderstood: "Milo n'a pas compris cette recherche. Essayez de reformuler, ou utilisez les filtres classiques ci-dessous.",
  emptyResultsWithCriteria: 'Aucune annonce ne correspond aux critères compris par Milo. Essayez de retirer une pastille.',
  unsupportedNotice: (siteLocaleName) => `Milo ne comprend pas encore cette langue — réponse en ${siteLocaleName}.`,
  categories: {
    region: 'Région',
    cityContains: 'Quartier/ville',
    minBeds: 'Chambres min.',
    maxBeds: 'Chambres max.',
    minRooms: 'Pièces min.',
    maxRooms: 'Pièces max.',
  },
  amenities: {
    wifi: 'Wi-Fi', clim: 'Climatisation', tv: 'TV', cuisine: 'Cuisine équipée',
    douche: 'Douche / SdB', gardien: 'Gardiennage', parking: 'Parking',
    piscine: 'Piscine', balcon: 'Balcon / Terrasse', generateur: 'Générateur',
  },
  bedsExact: (n) => `${n} chambre${n > 1 ? 's' : ''}`,
  roomsExact: (n) => `${n} pièce${n > 1 ? 's' : ''}`,
};

const EN: MiloLabels = {
  understoodPrefix: 'Milo understood:',
  unmatchedPrefix: 'Not understood:',
  rephrase: 'Rephrase',
  notUnderstood: "Milo didn't understand this search. Try rephrasing, or use the classic filters below.",
  emptyResultsWithCriteria: "No listings match what Milo understood. Try removing a chip.",
  unsupportedNotice: (siteLocaleName) => `Milo doesn't understand this language yet — replying in ${siteLocaleName}.`,
  categories: {
    region: 'Region',
    cityContains: 'Area/city',
    minBeds: 'Min. bedrooms',
    maxBeds: 'Max. bedrooms',
    minRooms: 'Min. rooms',
    maxRooms: 'Max. rooms',
  },
  amenities: {
    wifi: 'Wi-Fi', clim: 'Air conditioning', tv: 'TV', cuisine: 'Fitted kitchen',
    douche: 'Shower / Bathroom', gardien: 'Security guard', parking: 'Parking',
    piscine: 'Swimming pool', balcon: 'Balcony / Terrace', generateur: 'Generator',
  },
  bedsExact: (n) => `${n} bedroom${n > 1 ? 's' : ''}`,
  roomsExact: (n) => `${n} room${n > 1 ? 's' : ''}`,
};

const SITE_LOCALE_NAMES: Record<MiloUiLocale, string> = { fr: 'français', en: 'English' };

/** `unsupported` → répond dans la langue du site (siteLocale), jamais en silence. */
export function resolveMiloLocale(detectedLanguage: DetectedLanguage, siteLocale: MiloUiLocale): MiloUiLocale {
  return detectedLanguage === 'unsupported' ? siteLocale : detectedLanguage;
}

export function getMiloLabels(locale: MiloUiLocale): MiloLabels {
  return locale === 'en' ? EN : FR;
}

export function getSiteLocaleName(locale: MiloUiLocale): string {
  return SITE_LOCALE_NAMES[locale];
}
