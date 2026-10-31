import { normalizeText, levenshtein } from '../normalize';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import type { MiloAmbiguity, MiloMatchedSpan } from '../types';
import { PLACES } from '../places/places.data';
import { PLACE_ALIASES } from '../places/aliases';
import { QUARTIERS } from '../places/quartiers';
import { LANDMARKS } from '../places/landmarks';
import {
  NUMBERED_DISTRICT_BASES,
  parseDistrictNumber,
} from '../places/numberedDistricts';

export interface PlacesExtraction {
  region?: string;
  /** Valeur canonique pour le filtre tolérant `cityContains` (lot 2b) —
   * `city` (égalité exacte) n'est plus jamais émis par Milo : city est un
   * champ texte libre côté formulaire (78 % non canoniques, cf. rapport du
   * lot 2), l'égalité exacte y échoue trop souvent. */
  cityContains?: string;
  /** Repère connu à préférence douce associée (ex. Corniche → near_sea,
   * lot 7, règle 1.b). */
  softPreferences: string[];
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
  ambiguities: MiloAmbiguity[];
}

interface PlaceEntry {
  normalized: string;
  words: string[];
  kind: 'region' | 'place';
  /** Région déduite — absente si le nom est partagé par plusieurs régions
   * (ex. « Centre-ville » à Thiès ET Tambacounda) : on ne déduit alors rien,
   * seule la valeur de `city` reste certaine (règle 2 du lot 2). */
  canonicalRegion?: string;
  canonicalValue: string;
}

function buildIndex(): PlaceEntry[] {
  const entries: PlaceEntry[] = [];

  for (const p of PLACES) {
    const normRegion = normalizeText(p.region);
    entries.push({
      normalized: normRegion,
      words: normRegion.split(' '),
      kind: 'region',
      canonicalRegion: p.region,
      canonicalValue: p.region,
    });
  }

  // Villes/quartiers regroupés par forme normalisée, pour détecter les noms
  // partagés par plusieurs régions avant de déduire quoi que ce soit.
  // places.data.ts (généré) et quartiers.ts (saisi à la main, lot 2b)
  // alimentent le même index — un nom présent dans les deux (ex. Mermoz,
  // Almadies, Saly) ne crée pas de doublon, juste la même entrée confirmée
  // deux fois.
  const byNormalized = new Map<
    string,
    { canonicalValue: string; regions: Set<string> }
  >();
  const addPlace = (name: string, region: string) => {
    const norm = normalizeText(name);
    const existing = byNormalized.get(norm);
    if (existing) {
      existing.regions.add(region);
    } else {
      byNormalized.set(norm, {
        canonicalValue: name,
        regions: new Set([region]),
      });
    }
  };
  for (const p of PLACES) {
    for (const place of [...p.cities, ...p.neighborhoods])
      addPlace(place, p.region);
  }
  for (const q of QUARTIERS) addPlace(q.name, q.region);

  for (const [norm, { canonicalValue, regions }] of byNormalized) {
    entries.push({
      normalized: norm,
      words: norm.split(' '),
      kind: 'place',
      canonicalRegion: regions.size === 1 ? [...regions][0] : undefined,
      canonicalValue,
    });
  }

  for (const [aliasRaw, target] of Object.entries(PLACE_ALIASES)) {
    const normTarget = normalizeText(target);
    const resolved =
      entries.find((e) => e.normalized === normTarget && e.kind === 'region') ??
      entries.find((e) => e.normalized === normTarget && e.kind === 'place');
    if (!resolved) continue; // garde-fou : alias sans cible canonique existante.
    const normAlias = normalizeText(aliasRaw);
    entries.push({
      normalized: normAlias,
      words: normAlias.split(' '),
      kind: resolved.kind,
      canonicalRegion: resolved.canonicalRegion,
      canonicalValue: resolved.canonicalValue,
    });
  }

  return entries;
}

const PLACE_INDEX = buildIndex();
const MULTI_WORD = PLACE_INDEX.filter((e) => e.words.length > 1);
const SINGLE_WORD_REGIONS = PLACE_INDEX.filter(
  (e) => e.words.length === 1 && e.kind === 'region',
);
const SINGLE_WORD_PLACES = PLACE_INDEX.filter(
  (e) => e.words.length === 1 && e.kind === 'place',
);

function isRangeConsumed(
  start: number,
  end: number,
  consumed: ReadonlySet<number>,
): boolean {
  for (let k = start; k < end; k++) if (consumed.has(k)) return true;
  return false;
}

function findExact(list: PlaceEntry[], raw: string): PlaceEntry | undefined {
  return list.find((e) => e.normalized === raw);
}

/** Faute d'une lettre tolérée uniquement sur les noms de 6+ lettres, et
 * uniquement s'il n'y a qu'un seul candidat à distance ≤ 1 (règle 4). */
function findUniqueFuzzy(
  list: PlaceEntry[],
  raw: string,
): PlaceEntry | undefined {
  if (raw.length < 6) return undefined;
  const candidates = list.filter(
    (e) =>
      e.normalized.length >= 6 &&
      Math.abs(e.normalized.length - raw.length) <= 1 &&
      levenshtein(raw, e.normalized) <= 1,
  );
  const distinct = new Set(
    candidates.map((c) => `${c.kind}:${c.canonicalValue}`),
  );
  return distinct.size === 1 ? candidates[0] : undefined;
}

/**
 * Lieux (régions/villes/quartiers), indépendants de la langue — ne comptent
 * jamais dans `signals` (appelé hors du runExtractors par dictionnaire,
 * voir extractCriteria.ts). Un nom de région seul → region seule (règle 1).
 * Une ville/quartier connue → cityContains + region déduite si unique
 * (règle 2, lot 2b : city exact n'est plus émis, city étant un champ texte
 * libre en base). Plusieurs lieux de régions différentes → rien d'extrait
 * (règle 3).
 */
export function extractPlaces(
  tokens: Token[],
  alreadyConsumed: ReadonlySet<number>,
): PlacesExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const softPreferences: string[] = [];
  const ambiguities: MiloAmbiguity[] = [];
  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  interface Match {
    entry: PlaceEntry;
    start: number;
    end: number;
  }
  const matches: Match[] = [];

  // ── Quartiers numérotés (Liberté 5, Sicap Liberté IV…) — avant tout le
  // reste, pour que "Liberté" ne soit pas d'abord happé seul par le Pass 2
  // (règle 1.c). Bases les plus longues essayées en premier ("sicap
  // liberte" avant "liberte") pour ne jamais tronquer un nom composé. ────
  const sortedBases = [...NUMBERED_DISTRICT_BASES].sort(
    (a, b) => b.base.split(' ').length - a.base.split(' ').length,
  );
  for (const district of sortedBases) {
    const baseWords = district.base.split(' ');
    for (let i = 0; i + baseWords.length <= tokens.length; i++) {
      if (blocked(i, i + baseWords.length)) continue;
      const len = matchPhraseAt(tokens, i, district.base);
      if (!len) continue;
      // Connecteur optionnel ("unité"/"unite"/"unit") entre la base et le
      // numéro — "Parcelles Assainies unité 15" (lot 7, règle 1.c).
      const afterBase = i + len;
      const hasConnector = ['unite', 'unité', 'unit'].includes(
        tokens[afterBase]?.raw ?? '',
      );
      const numberIdx = hasConnector ? afterBase + 1 : afterBase;
      const numberTok = tokens[numberIdx];
      if (!numberTok) continue;
      const n = parseDistrictNumber(numberTok.raw);
      if (n === null || blocked(numberIdx, numberIdx + 1)) continue;
      if (hasConnector && blocked(afterBase, afterBase + 1)) continue;

      const known = district.knownNumbers.includes(n);
      const canonicalValue = known
        ? `${district.canonicalBase} ${n}`
        : district.canonicalBase;
      matches.push({
        entry: {
          normalized: district.base,
          words: baseWords,
          kind: 'place',
          canonicalRegion: district.region,
          canonicalValue,
        },
        start: i,
        end: i + len, // le numéro (et le connecteur) ne sont pas inclus dans le span "place" générique
      });
      for (let k = i; k < i + len; k++) consumed.add(k);
      if (hasConnector) consumed.add(afterBase);
      consumed.add(numberIdx); // le numéro reste "compris" : jamais un mot non compris
      if (!known) ambiguities.push('numberedDistrict');
    }
  }

  // ── Repères/axes routiers (VDN, Corniche, autoroute, aéroport, "route
  // de…") — jamais un cityContains (règle 1.b). Un repère déjà rattaché à
  // une préférence douce connue (Corniche → near_sea) la déclenche ; les
  // autres restent un mot non compris + ambiguïté "landmark" (non
  // consommés, pour apparaître dans unmatchedTokens). ────────────────────
  for (const landmark of LANDMARKS) {
    const words = landmark.normalized.split(' ');
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (blocked(i, i + words.length)) continue;
      const len = matchPhraseAt(tokens, i, landmark.normalized);
      if (!len) continue;
      ambiguities.push('landmark');
      if (landmark.softPreference) {
        softPreferences.push(landmark.softPreference);
        for (let k = i; k < i + len; k++) consumed.add(k);
      }
      // Sans préférence douce associée : ni consommé ni ajouté à `matches`
      // — reste dans unmatchedTokens (règle 1.b, "mot non compris").
    }
  }

  // Pass 1 : lieux à plusieurs mots d'abord (règle 4), avant les mots isolés.
  for (const entry of MULTI_WORD) {
    for (let i = 0; i + entry.words.length <= tokens.length; i++) {
      if (blocked(i, i + entry.words.length)) continue;
      const len = matchPhraseAt(tokens, i, entry.normalized);
      if (!len) continue;
      matches.push({ entry, start: i, end: i + len });
      for (let k = i; k < i + len; k++) consumed.add(k);
    }
  }

  // Pass 2 : un seul mot — les régions ont priorité sur les villes/quartiers
  // de même nom (ex. « Dakar » est aussi une ville de la région Dakar ;
  // « Kédougou » est aussi une ville de Tambacounda — la région gagne).
  for (let i = 0; i < tokens.length; i++) {
    if (blocked(i, i + 1)) continue;
    const raw = tokens[i].raw;

    const exact =
      findExact(SINGLE_WORD_REGIONS, raw) ?? findExact(SINGLE_WORD_PLACES, raw);
    if (exact) {
      matches.push({ entry: exact, start: i, end: i + 1 });
      consumed.add(i);
      continue;
    }

    const fuzzy =
      findUniqueFuzzy(SINGLE_WORD_REGIONS, raw) ??
      findUniqueFuzzy(SINGLE_WORD_PLACES, raw);
    if (fuzzy) {
      matches.push({ entry: fuzzy, start: i, end: i + 1 });
      consumed.add(i);
    }
  }

  for (const m of matches) {
    matchedSpans.push({
      category: 'place',
      text: tokens
        .slice(m.start, m.end)
        .map((t) => t.raw)
        .join(' '),
      value:
        m.entry.kind === 'region'
          ? m.entry.canonicalValue
          : `${m.entry.canonicalRegion ?? '?'}/${m.entry.canonicalValue}`,
    });
  }

  const regionMatches = matches.filter((m) => m.entry.kind === 'region');
  const placeMatches = matches.filter((m) => m.entry.kind === 'place');

  const impliedRegions = new Set<string>();
  for (const m of regionMatches) impliedRegions.add(m.entry.canonicalRegion!);
  for (const m of placeMatches) {
    if (m.entry.canonicalRegion) impliedRegions.add(m.entry.canonicalRegion);
  }

  if (impliedRegions.size > 1) {
    // Conflit : régions différentes évoquées — rien d'extrait pour le lieu
    // (mentions comprises mais non retenues, même principe que type/transaction).
    return { consumed, matchedSpans, softPreferences, ambiguities };
  }

  const region = impliedRegions.size === 1 ? [...impliedRegions][0] : undefined;

  if (placeMatches.length === 0) {
    // Que des mentions de région (règle 1 : « Dakar » seul → region only).
    return { region, consumed, matchedSpans, softPreferences, ambiguities };
  }

  const distinctPlaceValues = new Set(
    placeMatches.map((m) => m.entry.canonicalValue),
  );
  if (distinctPlaceValues.size > 1) {
    // Plusieurs villes/quartiers différents cités → region seule si connue
    // (règle 3), jamais de cityContains ambigu.
    return { region, consumed, matchedSpans, softPreferences, ambiguities };
  }

  return {
    region,
    cityContains: placeMatches[0].entry.canonicalValue,
    consumed,
    matchedSpans,
    softPreferences,
    ambiguities,
  };
}
