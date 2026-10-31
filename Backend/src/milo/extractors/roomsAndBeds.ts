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

/** Nombre de 1-2 chiffres, OU mot écrit (deux, three…), juste avant
 * l'indice `at`. Retourne [valeur, indiceDeDébut, indiceDeFin] ou null. */
function numberBeforeUnit(
  tokens: Token[],
  at: number,
  writtenNumbers: Record<string, number>,
): [number, number, number] | null {
  if (at - 1 < 0) return null;
  const prev = tokens[at - 1].raw;
  if (/^\d{1,2}$/.test(prev)) return [Number(prev), at - 1, at + 1];
  if (prev in writtenNumbers) return [writtenNumbers[prev], at - 1, at + 1];
  return null;
}

/** Forme collée : "2br"/"3pieces"/"3-bedroom" (tiret optionnel, jamais
 * d'espace — la normalisation NE retire PAS le tiret, lot 7 règle 3). */
function glueNumberUnit(raw: string, unitWord: string): number | null {
  const m = new RegExp(`^(\\d{1,2})-?${unitWord}$`).exec(raw);
  return m ? Number(m[1]) : null;
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

  // ── Pièces : F3 / T3 / F 3 / "3 pièces" / "3 rooms" ──────────────────
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i].raw;

    const glued = /^[ft](\d{1,2})$/.exec(raw);
    if (glued && !blocked(i, i + 1)) {
      const n = Number(glued[1]);
      minRooms = n;
      maxRooms = n;
      consumed.add(i);
      matchedSpans.push({ category: 'rooms', text: raw, value: String(n) });
      continue;
    }
    if (
      (raw === 'f' || raw === 't') &&
      tokens[i + 1] &&
      /^\d{1,2}$/.test(tokens[i + 1].raw) &&
      !blocked(i, i + 2)
    ) {
      const n = Number(tokens[i + 1].raw);
      minRooms = n;
      maxRooms = n;
      consumed.add(i);
      consumed.add(i + 1);
      matchedSpans.push({
        category: 'rooms',
        text: `${raw} ${tokens[i + 1].raw}`,
        value: String(n),
      });
      continue;
    }

    for (const dict of dictionaries) {
      for (const unit of dict.rooms.unitWords) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const before = numberBeforeUnit(tokens, i, writtenNumbers);
        if (!before) continue;
        const [n, s] = before;
        if (blocked(s, i + len)) continue;
        minRooms = n;
        maxRooms = n;
        consumed.add(s);
        for (let k = i; k < i + len; k++) consumed.add(k);
        matchedSpans.push({
          category: 'rooms',
          text: `${n} ${unit}`,
          value: String(n),
        });
      }
    }
  }

  // ── Chambres (beds) : "2 chambres" / "2 bedrooms" / "2br" / "2 ch" /
  // "3-bedroom" / "trois chambres" / "three bedrooms" ───────────────────
  // Valeurs "exactes" (sans qualificatif) : collectées d'abord, décidées
  // après coup — si plusieurs valeurs distinctes apparaissent dans la même
  // requête ("3 chambres, 2 bedrooms"), c'est un conflit : on ne fixe pas
  // minBeds/maxBeds (même principe que type/transaction), mais les tokens
  // restent marqués consumed (compris, juste contradictoire).
  const exactMatches: Array<{ value: number }> = [];

  function applyBeds(start: number, end: number, n: number) {
    // Qualificatif "au moins"/"at least"/"plus de"/"more than" juste avant.
    let qualifier: 'atLeast' | 'atMost' | null = null;
    let qualStart = start;
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
      }
    }
    if (blocked(start, end)) return;

    if (qualifier === 'atLeast') {
      minBeds = minBeds === undefined ? n : Math.min(minBeds, n);
      for (let k = qualStart; k < end; k++) consumed.add(k);
      matchedSpans.push({
        category: 'beds',
        text: `beds>=${n}`,
        value: String(n),
      });
    } else if (qualifier === 'atMost') {
      maxBeds = maxBeds === undefined ? n : Math.max(maxBeds, n);
      for (let k = qualStart; k < end; k++) consumed.add(k);
      matchedSpans.push({
        category: 'beds',
        text: `beds<=${n}`,
        value: String(n),
      });
    } else if (BEDS_WITHOUT_QUALIFIER_IS_EXACT) {
      exactMatches.push({ value: n });
      for (let k = qualStart; k < end; k++) consumed.add(k);
      matchedSpans.push({
        category: 'beds',
        text: `beds=${n}`,
        value: String(n),
      });
    }
  }

  for (const dict of dictionaries) {
    for (const unit of dict.beds.unitWords) {
      // Forme collée ("2br"/"3-bedroom").
      for (let i = 0; i < tokens.length; i++) {
        if (blocked(i, i + 1)) continue;
        const n = glueNumberUnit(tokens[i].raw, unit);
        if (n === null) continue;
        applyBeds(i, i + 1, n);
      }
      // Forme séparée ("2 chambres" / "2 bedrooms" / "trois chambres").
      for (let i = 0; i < tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const before = numberBeforeUnit(tokens, i, writtenNumbers);
        if (!before) continue;
        const [n, s] = before;
        if (blocked(s, i + len)) continue;
        applyBeds(s, i + len, n);
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
        const [n, s] = before;
        if (blocked(s, i + 1)) continue;
        if (n === 1 && !typeAlreadyKnown) {
          // "1 chambre" : type (une chambre à louer) ou nombre (1 bedroom)
          // — ambigu seulement si aucun autre type n'est déjà posé (sinon
          // "1 chambre" ne peut plus vouloir dire CHAMBRE, c'est forcément
          // un nombre — ex. "appartement avec 1 chambre").
          consumed.add(s);
          consumed.add(i);
          ambiguities.push('chambreCount');
          matchedSpans.push({
            category: 'beds',
            text: `${word}=1?`,
            value: '1',
          });
        } else {
          applyBeds(s, i + 1, n);
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

  if (exactMatches.length > 0) {
    const distinctValues = new Set(exactMatches.map((m) => m.value));
    if (distinctValues.size === 1) {
      const n = exactMatches[0].value;
      minBeds = n;
      maxBeds = n;
    }
    // Sinon, valeurs exactes contradictoires : aucune extraction beds
    // (tokens déjà marqués consumed et matchedSpans déjà enregistrés).
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
