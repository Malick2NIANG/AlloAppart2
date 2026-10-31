import { normalizeText } from './normalize';
import { tokenize, type Token } from './tokenize';
import { fr } from './dictionaries/fr';
import { en } from './dictionaries/en';
import { extractType } from './extractors/type';
import { extractTransaction } from './extractors/transaction';
import { extractAmenities } from './extractors/amenities';
import { extractSoftPreferences } from './extractors/softPreferences';
import { extractRoomsAndBeds } from './extractors/roomsAndBeds';
import { extractPrice } from './extractors/price';
import { extractPlaces } from './extractors/places';
import type {
  LanguageDictionary,
  MiloAmbiguity,
  MiloExtractionResult,
  MiloMatchedSpan,
  MiloStrictFilters,
} from './types';

const DICTIONARIES: LanguageDictionary[] = [fr, en];

/**
 * Lance la chaîne complète d'extracteurs sur un jeu de dictionnaires donné
 * (les deux langues ensemble pour l'extraction réelle ; une langue seule,
 * séparément, pour compter les `signals` par langue — lot 3).
 */
function runExtractors(tokens: Token[], dictionaries: LanguageDictionary[]) {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const strictFilters: MiloStrictFilters = {};
  const extraAmbiguities: MiloAmbiguity[] = [];

  // Ordre : catégories non numériques d'abord, pièces/chambres ensuite,
  // montants en dernier (son filtre anti "nombre suivi d'une unité
  // interdite" rend l'ordre non critique, mais ceci évite toute ambiguïté
  // résiduelle entre "plus de" prix et "plus de" chambres, § lot 1b).
  const typeRes = extractType(tokens, dictionaries, consumed);
  if (typeRes.type) strictFilters.type = typeRes.type;
  typeRes.consumed.forEach((i) => consumed.add(i));
  matchedSpans.push(...typeRes.matchedSpans);

  const txRes = extractTransaction(tokens, dictionaries, consumed);
  if (txRes.transactionType)
    strictFilters.transactionType = txRes.transactionType;
  txRes.consumed.forEach((i) => consumed.add(i));
  matchedSpans.push(...txRes.matchedSpans);

  const amenitiesRes = extractAmenities(tokens, dictionaries, consumed);
  if (amenitiesRes.amenities.length > 0)
    strictFilters.amenities = amenitiesRes.amenities;
  amenitiesRes.consumed.forEach((i) => consumed.add(i));
  matchedSpans.push(...amenitiesRes.matchedSpans);

  const softRes = extractSoftPreferences(tokens, dictionaries, consumed);
  softRes.consumed.forEach((i) => consumed.add(i));
  matchedSpans.push(...softRes.matchedSpans);

  // CHAMBRE (type) n'est posé que si aucun autre type n'a déjà été trouvé
  // (`typeRes.type`) et qu'il n'y avait pas déjà un conflit de types
  // (`typeRes.matchedSpans` avec >1 valeur de type) — coordination faite
  // ici, extractRoomsAndBeds reste pur (lot 7, règle 3).
  const typeAlreadyConflicted =
    !typeRes.type &&
    new Set(
      typeRes.matchedSpans
        .filter((s) => s.category === 'type')
        .map((s) => s.value),
    ).size > 1;
  const roomsRes = extractRoomsAndBeds(tokens, dictionaries, consumed, {
    existingType: typeRes.type,
    typeAlreadyConflicted,
  });
  if (roomsRes.minRooms !== undefined)
    strictFilters.minRooms = roomsRes.minRooms;
  if (roomsRes.maxRooms !== undefined)
    strictFilters.maxRooms = roomsRes.maxRooms;
  if (roomsRes.minBeds !== undefined) strictFilters.minBeds = roomsRes.minBeds;
  if (roomsRes.maxBeds !== undefined) strictFilters.maxBeds = roomsRes.maxBeds;
  if (roomsRes.type && !strictFilters.type) strictFilters.type = roomsRes.type;
  roomsRes.consumed.forEach((i) => consumed.add(i));
  matchedSpans.push(...roomsRes.matchedSpans);
  extraAmbiguities.push(...roomsRes.ambiguities);

  const priceRes = extractPrice(tokens, dictionaries, consumed);
  if (priceRes.minPrice !== undefined)
    strictFilters.minPrice = priceRes.minPrice;
  if (priceRes.maxPrice !== undefined)
    strictFilters.maxPrice = priceRes.maxPrice;
  priceRes.consumed.forEach((i) => consumed.add(i));
  matchedSpans.push(...priceRes.matchedSpans);
  extraAmbiguities.push(...priceRes.ambiguities);

  return {
    strictFilters,
    softPreferences: [
      ...softRes.softPreferences,
      ...amenitiesRes.softAmenities,
    ],
    matchedSpans,
    consumed,
    extraAmbiguities,
  };
}

/**
 * Conflits « compris mais non extrait » (lot 4) — dérivés des matchedSpans
 * déjà posés par les extracteurs du lot 1/2 (type.ts, transaction.ts,
 * roomsAndBeds.ts, places.ts marquent chaque mention comprise, même quand
 * elles se contredisent et qu'aucun filtre n'est retenu). Lecture seule :
 * aucun extracteur n'est modifié pour ça.
 */
function deriveAmbiguities(
  strictFilters: MiloStrictFilters,
  matchedSpans: MiloMatchedSpan[],
): MiloAmbiguity[] {
  const ambiguities: MiloAmbiguity[] = [];

  const typeValues = new Set(
    matchedSpans.filter((s) => s.category === 'type').map((s) => s.value),
  );
  if (!strictFilters.type && typeValues.size > 1) ambiguities.push('type');

  const txValues = new Set(
    matchedSpans
      .filter((s) => s.category === 'transaction')
      .map((s) => s.value),
  );
  if (!strictFilters.transactionType && txValues.size > 1) {
    ambiguities.push('transactionType');
  }

  if (
    strictFilters.minBeds === undefined &&
    strictFilters.maxBeds === undefined
  ) {
    const exactBedsValues = new Set(
      matchedSpans
        .filter((s) => s.category === 'beds' && s.text.startsWith('beds='))
        .map((s) => s.value),
    );
    if (exactBedsValues.size > 1) ambiguities.push('beds');
  }

  if (!strictFilters.region && !strictFilters.cityContains) {
    const regionsImplied = new Set(
      matchedSpans
        .filter((s) => s.category === 'place')
        .map((s) => (s.value?.includes('/') ? s.value.split('/')[0] : s.value)),
    );
    if (regionsImplied.size > 1) ambiguities.push('region');
  }

  return ambiguities;
}

function collectStopWords(dictionaries: LanguageDictionary[]): Set<string> {
  const stop = new Set<string>();
  for (const dict of dictionaries) for (const w of dict.stopWords) stop.add(w);
  return stop;
}

export function extractCriteria(text: string): MiloExtractionResult {
  const normalized = normalizeText(text ?? '');
  const tokens = tokenize(normalized);

  const main = runExtractors(tokens, DICTIONARIES);

  // Lieux : indépendants de la langue, appliqués hors du pipeline FR/EN —
  // ne comptent jamais dans `signals` (règle 5 du lot 2), et ne retraitent
  // pas les tokens déjà consommés par le lot 1 (règle 7).
  const placesRes = extractPlaces(tokens, main.consumed);
  if (placesRes.region) main.strictFilters.region = placesRes.region;
  if (placesRes.cityContains)
    main.strictFilters.cityContains = placesRes.cityContains;
  placesRes.consumed.forEach((i) => main.consumed.add(i));
  main.matchedSpans.push(...placesRes.matchedSpans);
  main.extraAmbiguities.push(...placesRes.ambiguities);
  main.softPreferences.push(...placesRes.softPreferences);

  const stopWords = collectStopWords(DICTIONARIES);
  const unmatchedTokens = tokens
    .filter((t) => !main.consumed.has(t.index) && !stopWords.has(t.raw))
    .map((t) => t.raw);

  // `signals` : chaque langue est lancée SEULE sur un état neuf (tokens
  // identiques, aucun `consumed` partagé) — sert uniquement à compter des
  // mots-clés reconnus par langue pour la détection de langue du lot 3,
  // n'influence jamais `strictFilters` (calculé ci-dessus avec les deux
  // dictionnaires ensemble, § PLAN_SEARCH_V0.md 2.c).
  const frOnly = runExtractors(tokens, [fr]);
  const enOnly = runExtractors(tokens, [en]);

  return {
    strictFilters: main.strictFilters,
    softPreferences: main.softPreferences,
    matchedSpans: main.matchedSpans,
    unmatchedTokens,
    signals: {
      fr: frOnly.matchedSpans.length,
      en: enOnly.matchedSpans.length,
    },
    ambiguities: [
      ...new Set([
        ...deriveAmbiguities(main.strictFilters, main.matchedSpans),
        ...main.extraAmbiguities,
      ]),
    ],
  };
}
