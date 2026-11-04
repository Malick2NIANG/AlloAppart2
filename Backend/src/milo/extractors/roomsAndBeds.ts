import { ListingType } from '@prisma/client';
import type {
  LanguageDictionary,
  MiloAmbiguity,
  MiloMatchedSpan,
} from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';

/**
 * « 2 chambres »/« 2 bedrooms » sans mot-clé « au moins »/« au plus » :
 * valeur EXACTE par défaut (minBeds = maxBeds = n). Centralisé ici en une
 * constante unique (PLAN demandé) pour pouvoir changer ce choix sans
 * chercher dans tout le fichier.
 */
export const BEDS_WITHOUT_QUALIFIER_IS_EXACT = true;

export interface RoomsAndBedsOptions {
  /** Type déjà trouvé par extractType — bloque toute déduction CHAMBRE à
   * partir d'un "chambre"/"room" nu (lot 7, règle 3 : jamais de
   * substitution). */
  existingType?: ListingType;
  /** Plusieurs types différents déjà compris mais contradictoires — même
   * principe : ne pas ajouter un 3e candidat CHAMBRE par-dessus. */
  typeAlreadyConflicted?: boolean;
}

export interface RoomsAndBedsExtraction {
  minRooms?: number;
  maxRooms?: number;
  minBeds?: number;
  maxBeds?: number;
  /** CHAMBRE — posé seulement si `options.existingType` était vide et sans
   * conflit (lot 7, règle 3). */
  type?: ListingType;
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
  ambiguities: MiloAmbiguity[];
}

function isRangeConsumed(
  start: number,
  end: number,
  consumed: ReadonlySet<number>,
): boolean {
  for (let k = start; k < end; k++) if (consumed.has(k)) return true;
  return false;
}

/** Nombre de 1-2 chiffres (forme "3+" comprise — "au moins 3", lot 7 bis),
 * OU mot écrit (deux, three…), juste avant l'indice `at`. Retourne
 * [valeur, indiceDeDébut, indiceDeFin, estAuMoins] ou null. */
function numberBeforeUnit(
  tokens: Token[],
  at: number,
  writtenNumbers: Record<string, number>,
): [number, number, number, boolean] | null {
  if (at - 1 < 0) return null;
  const prev = tokens[at - 1].raw;
  const plus = /^(\d{1,2})\+$/.exec(prev);
  if (plus) return [Number(plus[1]), at - 1, at + 1, true];
  if (/^\d{1,2}$/.test(prev)) return [Number(prev), at - 1, at + 1, false];
  if (prev in writtenNumbers)
    return [writtenNumbers[prev], at - 1, at + 1, false];
  return null;
}

/** Forme collée : "2br"/"3pieces"/"3-bedroom" (tiret optionnel, jamais
 * d'espace — la normalisation NE retire PAS le tiret, lot 7 règle 3). */
function glueNumberUnit(raw: string, unitWord: string): number | null {
  const m = new RegExp(`^(\\d{1,2})-?${unitWord}$`).exec(raw);
  return m ? Number(m[1]) : null;
}

const RANGE_BARE_MID_WORDS = ['a', 'to', 'or']; // "a" = "à" (accents retirés)
const RANGE_PREFIX_WORDS = ['entre', 'between'];
const RANGE_PREFIXED_MID_WORDS = ['et', 'and'];

/** Intervalle juste avant l'indice `unitStart` : "2 à 3 chambres" / "2-3
 * chambres" / "entre 2 et 3 chambres" / "2 or 3 bedrooms" / "2 to 3
 * bedrooms" / "between 2 and 3 bedrooms" (lot 7 bis, règle C). Retourne
 * [min, max, indiceDeDébut] ou null — jamais "chambre" seule ("F3"/"2
 * chambres" restent une égalité, inchangé). */
function findRangeBeforeUnit(
  tokens: Token[],
  unitStart: number,
  writtenNumbers: Record<string, number>,
): [number, number, number] | null {
  const numAt = (idx: number): number | null => {
    const raw = tokens[idx]?.raw;
    if (raw === undefined) return null;
    if (/^\d{1,2}$/.test(raw)) return Number(raw);
    if (raw in writtenNumbers) return writtenNumbers[raw];
    return null;
  };

  // "2-3 chambres" — un seul token "2-3" juste avant l'unité.
  const glued = /^(\d{1,2})-(\d{1,2})$/.exec(tokens[unitStart - 1]?.raw ?? '');
  if (glued) {
    const a = Number(glued[1]);
    const b = Number(glued[2]);
    return [Math.min(a, b), Math.max(a, b), unitStart - 1];
  }

  const n2 = numAt(unitStart - 1);
  const mid = tokens[unitStart - 2]?.raw;
  const n1 = numAt(unitStart - 3);
  if (n1 === null || n2 === null) return null;

  // "2 à/to/or 3 chambres" — mot central nu, "entre"/"between" optionnel.
  if (mid && RANGE_BARE_MID_WORDS.includes(mid)) {
    const prefixWord = tokens[unitStart - 4]?.raw;
    const hasPrefix = !!prefixWord && RANGE_PREFIX_WORDS.includes(prefixWord);
    return [
      Math.min(n1, n2),
      Math.max(n1, n2),
      hasPrefix ? unitStart - 4 : unitStart - 3,
    ];
  }
  // "entre 2 et 3 chambres" / "between 2 and 3 bedrooms" — "et"/"and" exige
  // le préfixe "entre"/"between" (jamais "2 et 3 chambres" nu, pas naturel).
  if (mid && RANGE_PREFIXED_MID_WORDS.includes(mid)) {
    const prefixWord = tokens[unitStart - 4]?.raw;
    if (prefixWord && RANGE_PREFIX_WORDS.includes(prefixWord)) {
      return [Math.min(n1, n2), Math.max(n1, n2), unitStart - 4];
    }
  }
  return null;
}

export function extractRoomsAndBeds(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
  options: RoomsAndBedsOptions = {},
): RoomsAndBedsExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const ambiguities: MiloAmbiguity[] = [];
  let minRooms: number | undefined;
  let maxRooms: number | undefined;
  let minBeds: number | undefined;
  let maxBeds: number | undefined;
  let chambreType: ListingType | undefined;

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  const writtenNumbers: Record<string, number> = {};
  for (const dict of dictionaries)
    Object.assign(writtenNumbers, dict.beds.writtenNumbers);

  // ── Intervalles pièces/chambres ("2 à 3 chambres", "2-3 bedrooms"…) —
  // avant tout le reste, pour que les deux nombres ne soient pas d'abord
  // happés par l'égalité exacte habituelle (lot 7 bis, règle C). ────────
  for (const dict of dictionaries) {
    for (const unit of dict.rooms.unitWords) {
      for (let i = 0; i < tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const range = findRangeBeforeUnit(tokens, i, writtenNumbers);
        if (!range) continue;
        const [lo, hi, s] = range;
        if (blocked(s, i + len)) continue;
        minRooms = lo;
        maxRooms = hi;
        for (let k = s; k < i + len; k++) consumed.add(k);
        matchedSpans.push({
          category: 'rooms',
          text: `${lo}-${hi} ${unit}`,
          value: `${lo}-${hi}`,
        });
      }
    }
    for (const unit of dict.beds.unitWords) {
      for (let i = 0; i < tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const range = findRangeBeforeUnit(tokens, i, writtenNumbers);
        if (!range) continue;
        const [lo, hi, s] = range;
        if (blocked(s, i + len)) continue;
        minBeds = lo;
        maxBeds = hi;
        for (let k = s; k < i + len; k++) consumed.add(k);
        matchedSpans.push({
          category: 'beds',
          text: `${lo}-${hi} ${unit}`,
          value: `${lo}-${hi}`,
        });
      }
    }
  }

  // ── Pièces (F3/T3) et chambres (beds) : "2 chambres" / "2 bedrooms" /
  // "2br" / "2 ch" / "3-bedroom" / "trois chambres" / "three bedrooms" /
  // "3 pièces" / "F3" ────────────────────────────────────────────────────
  // Valeurs "exactes" (sans qualificatif) : collectées d'abord, décidées
  // après coup — si plusieurs valeurs distinctes apparaissent dans la même
  // requête ("3 chambres, 2 bedrooms"), c'est un conflit : on ne fixe pas
  // minBeds/maxBeds (même principe que type/transaction), mais les tokens
  // restent marqués consumed (compris, juste contradictoire). Même
  // principe pour les pièces (minRooms/maxRooms).
  type CountKind = 'beds' | 'rooms';
  const exactMatches: Record<CountKind, Array<{ value: number }>> = {
    beds: [],
    rooms: [],
  };

  /** Qualificatif "au moins"/"at least"/"plus de"/"more than" AVANT, ou
   * "minimum"/"maximum"/"ou plus"/"or more"/"up to" APRÈS, pour les
   * chambres ET pour les pièces (lot 7 bis, règle C — "même règle pour les
   * pièces" ; ex. "F3 minimum" → minRooms seul, comme "2 chambres
   * minimum" → minBeds seul). */
  function applyCount(
    kind: CountKind,
    start: number,
    end: number,
    n: number,
    forceAtLeast = false,
  ) {
    // Qualificatif "au moins"/"at least"/"plus de"/"more than" AVANT, ou
    // "minimum"/"maximum"/"ou plus"/"or more"/"up to" APRÈS (lot 7 bis,
    // règle C — "2 chambres minimum", "2 bedrooms or more").
    let qualifier: 'atLeast' | 'atMost' | null = forceAtLeast
      ? 'atLeast'
      : null;
    let qualStart = start;
    let qualEnd = end;
    for (const dict of dictionaries) {
      for (const kw of dict.beds.atLeastKeywords) {
        const words = kw.split(' ');
        const from = start - words.length;
        if (
          from >= 0 &&
          matchPhraseAt(tokens, from, kw) === words.length &&
          !blocked(from, start)
        ) {
          qualifier = 'atLeast';
          qualStart = from;
        }
        // Collé immédiatement après (0 mot d'écart) seulement : "2
        // chambres minimum"/"2 bedrooms or more" sont toujours adjacents ;
        // une fenêtre plus large happait un "maximum" d'une tout autre
        // phrase plus loin ("3 chambres, 60 millions maximum" — lot 7 bis,
        // bug découvert sur ce cas réel). Une virgule/point entre les deux
        // (perdue à la tokenisation mais retenue via `brokenAfter`) bloque
        // aussi ce collage : "minimum 3 bedrooms, max 500000" ne doit pas
        // happer le "max" de la clause de prix suivante.
        const lenAtEnd = !tokens[end - 1]?.brokenAfter
          ? matchPhraseAt(tokens, end, kw)
          : 0;
        if (lenAtEnd && !blocked(end, end + lenAtEnd)) {
          qualifier = 'atLeast';
          qualEnd = Math.max(qualEnd, end + lenAtEnd);
        }
      }
      for (const kw of dict.beds.atMostKeywords) {
        const words = kw.split(' ');
        const from = start - words.length;
        if (
          from >= 0 &&
          matchPhraseAt(tokens, from, kw) === words.length &&
          !blocked(from, start)
        ) {
          qualifier = 'atMost';
          qualStart = from;
        }
        // Même garde-fou que ci-dessus : collé (0 mot d'écart) seulement,
        // et pas à travers une virgule/point.
        const lenAtEnd = !tokens[end - 1]?.brokenAfter
          ? matchPhraseAt(tokens, end, kw)
          : 0;
        if (lenAtEnd && !blocked(end, end + lenAtEnd)) {
          qualifier = 'atMost';
          qualEnd = Math.max(qualEnd, end + lenAtEnd);
        }
      }
    }
    if (blocked(start, end)) return;

    const category = kind === 'beds' ? 'beds' : 'rooms';
    if (qualifier === 'atLeast') {
      if (kind === 'beds')
        minBeds = minBeds === undefined ? n : Math.min(minBeds, n);
      else minRooms = minRooms === undefined ? n : Math.min(minRooms, n);
      for (let k = qualStart; k < qualEnd; k++) consumed.add(k);
      matchedSpans.push({ category, text: `${kind}>=${n}`, value: String(n) });
    } else if (qualifier === 'atMost') {
      if (kind === 'beds')
        maxBeds = maxBeds === undefined ? n : Math.max(maxBeds, n);
      else maxRooms = maxRooms === undefined ? n : Math.max(maxRooms, n);
      for (let k = qualStart; k < qualEnd; k++) consumed.add(k);
      matchedSpans.push({ category, text: `${kind}<=${n}`, value: String(n) });
    } else if (BEDS_WITHOUT_QUALIFIER_IS_EXACT) {
      exactMatches[kind].push({ value: n });
      for (let k = qualStart; k < qualEnd; k++) consumed.add(k);
      matchedSpans.push({ category, text: `${kind}=${n}`, value: String(n) });
    }
  }

  // ── Pièces : F3 / T3 / F 3 / "3 pièces" / "3 rooms" ──────────────────
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i].raw;

    const glued = /^[ft](\d{1,2})$/.exec(raw);
    if (glued && !blocked(i, i + 1)) {
      applyCount('rooms', i, i + 1, Number(glued[1]));
      continue;
    }
    if (
      (raw === 'f' || raw === 't') &&
      tokens[i + 1] &&
      /^\d{1,2}$/.test(tokens[i + 1].raw) &&
      !blocked(i, i + 2)
    ) {
      applyCount('rooms', i, i + 2, Number(tokens[i + 1].raw));
      continue;
    }

    for (const dict of dictionaries) {
      for (const unit of dict.rooms.unitWords) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const before = numberBeforeUnit(tokens, i, writtenNumbers);
        if (!before) continue;
        const [n, s, , plus] = before;
        if (blocked(s, i + len)) continue;
        applyCount('rooms', s, i + len, n, plus);
      }
    }
  }

  for (const dict of dictionaries) {
    for (const unit of dict.beds.unitWords) {
      // Forme collée ("2br"/"3-bedroom").
      for (let i = 0; i < tokens.length; i++) {
        if (blocked(i, i + 1)) continue;
        const n = glueNumberUnit(tokens[i].raw, unit);
        if (n === null) continue;
        applyCount('beds', i, i + 1, n);
      }
      // Forme séparée ("2 chambres" / "2 bedrooms" / "trois chambres" /
      // "3+ bedrooms").
      for (let i = 0; i < tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const before = numberBeforeUnit(tokens, i, writtenNumbers);
        if (!before) continue;
        const [n, s, , plus] = before;
        if (blocked(s, i + len)) continue;
        applyCount('beds', s, i + len, n, plus);
      }
    }
  }

  // ── "chambre"/"room" nu : type CHAMBRE, nombre de chambres, ou
  // ambiguïté — lot 7, règle 3. Mot à part (pas dans `beds.unitWords`),
  // pour ne jamais être doublement traité par la boucle ci-dessus. ──────
  const typeAlreadyKnown =
    !!options.existingType || !!options.typeAlreadyConflicted;
  for (const dict of dictionaries) {
    const word = dict.chambreTypeWord;
    for (let i = 0; i < tokens.length; i++) {
      if (blocked(i, i + 1)) continue;
      if (tokens[i].raw !== word) continue;
      const before = numberBeforeUnit(tokens, i, writtenNumbers);
      if (before) {
        const [n, s, , plus] = before;
        if (blocked(s, i + 1)) continue;
        if (n === 1 && !typeAlreadyKnown && !plus) {
          // "1 chambre" : type (une chambre à louer) ou nombre (1 bedroom)
          // — ambigu seulement si aucun autre type n'est déjà posé (sinon
          // "1 chambre" ne peut plus vouloir dire CHAMBRE, c'est forcément
          // un nombre — ex. "appartement avec 1 chambre"). "1+ chambre"
          // n'est jamais le type : "+" exclut l'article indéfini.
          consumed.add(s);
          consumed.add(i);
          ambiguities.push('chambreCount');
          matchedSpans.push({
            category: 'beds',
            text: `${word}=1?`,
            value: '1',
          });
        } else {
          applyCount('beds', s, i + 1, n, plus);
        }
        continue;
      }
      // Pas de nombre devant : "une chambre"/"a room"/"chambre pour 2
      // nuits" — type CHAMBRE, seulement si aucun autre type n'est déjà
      // posé ou en conflit (jamais de substitution, lot 7 règle 3).
      if (typeAlreadyKnown || chambreType) continue;
      chambreType = ListingType.CHAMBRE;
      consumed.add(i);
      matchedSpans.push({
        category: 'type',
        text: word,
        value: ListingType.CHAMBRE,
      });
    }
  }

  if (exactMatches.beds.length > 0) {
    const distinctValues = new Set(exactMatches.beds.map((m) => m.value));
    if (distinctValues.size === 1) {
      const n = exactMatches.beds[0].value;
      minBeds = n;
      maxBeds = n;
    }
    // Sinon, valeurs exactes contradictoires : aucune extraction beds
    // (tokens déjà marqués consumed et matchedSpans déjà enregistrés).
  }
  if (exactMatches.rooms.length > 0) {
    const distinctValues = new Set(exactMatches.rooms.map((m) => m.value));
    if (distinctValues.size === 1) {
      const n = exactMatches.rooms[0].value;
      minRooms = n;
      maxRooms = n;
    }
    // Même principe que beds : valeurs contradictoires → aucune extraction.
  }

  return {
    minRooms,
    maxRooms,
    minBeds,
    maxBeds,
    type: chambreType,
    consumed,
    matchedSpans,
    ambiguities,
  };
}
