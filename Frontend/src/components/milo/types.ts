/**
 * Milo Search v0 — lot 5 (Frontend). Duplique volontairement la forme de
 * Backend/src/milo/milo.service.ts (ParseQueryResponse) et
 * Backend/src/milo/types.ts (MiloStrictFilters, MiloAmbiguity) : Frontend et
 * Backend sont deux packages npm séparés, sans import cross-package possible
 * — ce fichier est la frontière du contrat, à garder synchronisé à la main.
 */

export type DetectedLanguage = 'fr' | 'en' | 'unsupported';
export type DetectionMethod = 'dictionary' | 'library' | 'default';
export type MiloAmbiguity =
  | 'type'
  | 'transactionType'
  | 'beds'
  | 'region'
  | 'periodNotSupported'
  | 'landmark'
  | 'numberedDistrict'
  | 'amountDirection'
  | 'approximateAmount'
  | 'chambreCount'
  | 'stayTotal'
  | 'negatedAmenity'
  | 'targetAmount'
  | 'rentalModeConflict'
  | 'derivedNightlyBudget';

export interface MiloStrictFilters {
  minPrice?: number;
  maxPrice?: number;
  minRooms?: number;
  maxRooms?: number;
  minBeds?: number;
  maxBeds?: number;
  type?: string;
  transactionType?: 'LOCATION' | 'VENTE';
  amenities?: string[];
  region?: string;
  cityContains?: string;
  /** Meublé/non meublé — même nom que FilterListingsDto.furnished (lot
   * meublé/durée). */
  furnished?: boolean;
  /** NIGHTLY/MONTHLY — jamais MIXED en sortie de Milo (lot meublé/durée). */
  rentalMode?: 'NIGHTLY' | 'MONTHLY';
  /** Sur pricePerNight, jamais price (lot meublé/durée). */
  minPricePerNight?: number;
  maxPricePerNight?: number;
}

/** Milo FAQ (lot « Milo FAQ ») — présent uniquement quand la phrase est une
 * question sur la plateforme sans aucun critère de recherche de logement.
 * `answerKey` est résolu côté Frontend via le namespace i18n `miloFaq.*` —
 * le Backend ne connaît jamais le texte de la réponse. */
export interface MiloFaqResult {
  id: string;
  answerKey: string;
  confidence: number;
}

export interface ParseQueryResponse {
  detectedLanguage: DetectedLanguage;
  languageConfidence: number;
  languageMethod: DetectionMethod;
  strictFilters: MiloStrictFilters;
  softPreferences: string[];
  unmatchedTokens: string[];
  ambiguities: MiloAmbiguity[];
  understood: boolean;
  faq?: MiloFaqResult;
}
