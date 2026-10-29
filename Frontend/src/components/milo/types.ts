/**
 * Milo Search v0 — lot 5 (Frontend). Duplique volontairement la forme de
 * Backend/src/milo/milo.service.ts (ParseQueryResponse) et
 * Backend/src/milo/types.ts (MiloStrictFilters, MiloAmbiguity) : Frontend et
 * Backend sont deux packages npm séparés, sans import cross-package possible
 * — ce fichier est la frontière du contrat, à garder synchronisé à la main.
 */

export type DetectedLanguage = 'fr' | 'en' | 'unsupported';
export type DetectionMethod = 'dictionary' | 'library' | 'default';
export type MiloAmbiguity = 'type' | 'transactionType' | 'beds' | 'region';

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
}
