/**
 * Milo Search v0 — lot 1b (Frontend/rapports-milo/PLAN_SEARCH_V0.md § 2.c,
 * 2.h ; Milo.md § 3.4, 3.4 bis). Fonctions pures : pas de base, pas de
 * réseau, pas de Meilisearch, pas de contrôleur Nest à ce stade.
 */
import type { ListingType, TransactionType } from '@prisma/client';

/** Sous-ensemble de FilterListingsDto que l'extraction peut produire. */
export interface MiloStrictFilters {
  minPrice?: number;
  maxPrice?: number;
  minRooms?: number;
  maxRooms?: number;
  minBeds?: number;
  maxBeds?: number;
  type?: ListingType;
  transactionType?: TransactionType;
  amenities?: string[];
}

export type MiloSpanCategory =
  | 'price'
  | 'rooms'
  | 'beds'
  | 'type'
  | 'transaction'
  | 'amenity'
  | 'softPreference';

export interface MiloMatchedSpan {
  category: MiloSpanCategory;
  /** Extrait du texte NORMALISÉ (minuscules, sans accents) ayant déclenché le match. */
  text: string;
  /** Identifiant canonique produit (ex. "clim", "near_sea", "LOCATION"). Absent si match "conflit" (plusieurs types/transactions) sans filtre posé. */
  value?: string;
}

export interface MiloExtractionResult {
  strictFilters: MiloStrictFilters;
  /** Identifiants stables, jamais du texte traduit (ex. "near_sea", "quiet", "upscale"). */
  softPreferences: string[];
  matchedSpans: MiloMatchedSpan[];
  /** Mots non reconnus, mots vides déjà exclus. */
  unmatchedTokens: string[];
  /** Nombre de mots-clés reconnus par langue — sert la détection de langue au lot 3. */
  signals: { fr: number; en: number };
}

/** Dictionnaire d'une langue — une entrée par catégorie, synonymes → identifiant canonique. */
export interface LanguageDictionary {
  code: 'fr' | 'en';
  stopWords: string[];
  price: {
    maxKeywords: string[];
    minKeywords: string[];
    /** "entre X et Y" → { start: 'entre', mid: 'et' } ; "de X à Y" → { start: 'de', mid: 'a' }. */
    betweenKeywords: { start: string; mid: string }[];
    multipliers: Record<string, number>;
    currencyWords: string[];
  };
  rooms: {
    /** "3 pièces" / "3 rooms" — mot-unité après le nombre. */
    unitWords: string[];
  };
  beds: {
    /** "2 chambres" / "2 bedrooms" — mot-unité après le nombre. */
    unitWords: string[];
    atLeastKeywords: string[];
    atMostKeywords: string[];
  };
  /** Phrases figées déclenchant type=CHAMBRE (jamais la chambre seule sans nombre devant). */
  chambrePhrases: string[];
  studioWords: string[];
  type: Partial<Record<ListingType, string[]>>;
  transaction: Partial<Record<TransactionType, string[]>>;
  /** clé canonique d'équipement (Frontend/src/lib/listingProfile.ts) → synonymes de cette langue. */
  amenities: Record<string, string[]>;
  /** identifiant stable de préférence floue → synonymes de cette langue. */
  softPreferences: Record<string, string[]>;
}
