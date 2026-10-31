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
  /** Nom canonique de région, tel qu'accepté par le filtre `region` (lot 2). */
  region?: string;
  /** Valeur canonique de ville/quartier, pour le filtre tolérant
   * `cityContains` (lot 2b) — `city` (égalité exacte) n'est plus émis,
   * city étant un champ texte libre côté formulaire. */
  cityContains?: string;
}

export type MiloSpanCategory =
  | 'price'
  | 'rooms'
  | 'beds'
  | 'type'
  | 'transaction'
  | 'amenity'
  | 'softPreference'
  | 'place';

export interface MiloMatchedSpan {
  category: MiloSpanCategory;
  /** Extrait du texte NORMALISÉ (minuscules, sans accents) ayant déclenché le match. */
  text: string;
  /** Identifiant canonique produit (ex. "clim", "near_sea", "LOCATION"). Absent si match "conflit" (plusieurs types/transactions) sans filtre posé. */
  value?: string;
}

/**
 * Identifiants de conflit « compris mais non extrait » — lot 4, étendu lot 7
 * (mesure indépendante) : un montant/lieu/chambre a bien été repéré dans le
 * texte, mais aucun filtre strict n'a été posé pour lui — jamais une donnée
 * inventée, toujours un signal pour l'interface (ex. « prix par nuit non
 * pris en charge », « quartier numéroté non reconnu »).
 */
export type MiloAmbiguity =
  | 'type'
  | 'transactionType'
  | 'beds'
  | 'region'
  /** Montant suivi/précédé d'une période non mensuelle (nuit, jour,
   * semaine, an…) — jamais lu comme min/maxPrice (lot 7, règle 1.a). */
  | 'periodNotSupported'
  /** Repère/axe routier connu (VDN, Corniche, autoroute, aéroport, « route
   * de … ») — jamais un cityContains (lot 7, règle 1.b). */
  | 'landmark'
  /** Quartier numéroté (Liberté 5, HLM 3…) dont le numéro précis n'est pas
   * dans la liste connue — cityContains posé sur le nom SANS numéro (lot 7,
   * règle 1.c). */
  | 'numberedDistrict'
  /** Montant repéré sans mot-clé de direction (min/max) et sans « budget »
   * — aucun filtre posé (lot 7, règle 2, direction). */
  | 'amountDirection'
  /** Montant approximatif (environ, autour de, ~…) — maxPrice posé avec une
   * marge de +10 %, à afficher comme « ≈ » côté interface (lot 7, règle 2). */
  | 'approximateAmount'
  /** "1 chambre"/"1 room" : un seul chambre peut signifier le type CHAMBRE
   * ("une chambre à louer") ou un nombre de chambres (1 bedroom) — les deux
   * compris, aucun retenu (lot 7, règle 3). */
  | 'chambreCount';

export interface MiloExtractionResult {
  strictFilters: MiloStrictFilters;
  /** Identifiants stables, jamais du texte traduit (ex. "near_sea", "quiet", "upscale"). */
  softPreferences: string[];
  matchedSpans: MiloMatchedSpan[];
  /** Mots non reconnus, mots vides déjà exclus. */
  unmatchedTokens: string[];
  /** Nombre de mots-clés reconnus par langue — sert la détection de langue au lot 3. */
  signals: { fr: number; en: number };
  /** Catégories où plusieurs valeurs contradictoires ont été comprises mais
   * aucune retenue (ex. deux types, deux transactions, deux régions). */
  ambiguities: MiloAmbiguity[];
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
    /** "200k-300k" — tiret entre deux montants, sans mot-clé (lot 7). */
    rangeHyphen: boolean;
    multipliers: Record<string, number>;
    currencyWords: string[];
    /** Période NON mensuelle juste avant/après un montant (la nuit, par
     * jour, per week…) — ce montant n'est alors JAMAIS un prix (lot 7,
     * règle 1.a). */
    nonMonthlyPeriodKeywords: string[];
    /** Période mensuelle explicite (par mois, mensuel, monthly…) — unité par
     * défaut, n'empêche jamais l'extraction (lot 7, règle 1.a). */
    monthlyPeriodKeywords: string[];
    /** Montant approximatif (environ, autour de, ~…) — lot 7, règle 2. */
    approximateKeywords: string[];
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
    /** Mot ÉCRIT (un, deux... / one, two...) → valeur — 1 à 10 (lot 7). */
    writtenNumbers: Record<string, number>;
  };
  /** Phrases figées déclenchant type=CHAMBRE (jamais la chambre seule sans nombre devant). */
  chambrePhrases: string[];
  /** Mot nu (sans nombre devant, sans autre type trouvé) déclenchant
   * type=CHAMBRE — "chambre"/"room" (lot 7, règle 3). Distinct de
   * `beds.unitWords` : le même mot sert aussi à compter des chambres
   * quand un nombre le précède (coordination faite dans roomsAndBeds.ts). */
  chambreTypeWord: string;
  studioWords: string[];
  type: Partial<Record<ListingType, string[]>>;
  transaction: Partial<Record<TransactionType, string[]>>;
  /** clé canonique d'équipement (Frontend/src/lib/listingProfile.ts) → synonymes de cette langue. */
  amenities: Record<string, string[]>;
  /** Mot/phrase de préférence (de préférence, idéalement... / preferably...)
   * juste avant/après un équipement reconnu : l'équipement devient une
   * préférence douce au lieu d'un filtre strict (lot 7, règle 4). */
  preferenceMarkers: string[];
  /** identifiant stable de préférence floue → synonymes de cette langue. */
  softPreferences: Record<string, string[]>;
}
