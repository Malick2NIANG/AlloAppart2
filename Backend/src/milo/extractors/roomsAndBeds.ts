import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';

/**
 * « 2 chambres »/« 2 bedrooms » sans mot-clé « au moins »/« au plus » :
 * valeur EXACTE par défaut (minBeds = maxBeds = n). Centralisé ici en une
 * constante unique (PLAN demandé) pour pouvoir changer ce choix sans
 * chercher dans tout le fichier.
 */
export const BEDS_WITHOUT_QUALIFIER_IS_EXACT = true;

export interface RoomsAndBedsExtraction {
  minRooms?: number;
  maxRooms?: number;
  minBeds?: number;
  maxBeds?: number;
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
}

function isRangeConsumed(
  start: number,
  end: number,
  consumed: ReadonlySet<number>,
): boolean {
  for (let k = start; k < end; k++) if (consumed.has(k)) return true;
  return false;
}

/** Nombre de 1-2 chiffres juste avant l'indice `at`, sous forme de token
 * séparé ("3" "pieces") ou collé au mot-unité ("3pieces"/"2br"). Retourne
 * [valeur, indiceDeDébut, indiceDeFin] ou null. */
function numberBeforeUnit(
  tokens: Token[],
  at: number,
): [number, number, number] | null {
  // Forme séparée : token numérique juste avant.
  if (at - 1 >= 0 && /^\d{1,2}$/.test(tokens[at - 1].raw)) {
    return [Number(tokens[at - 1].raw), at - 1, at + 1];
  }
  return null;
}

/** Forme collée : "2br"/"3pieces" — un seul token chiffre+mot-unité. */
function glueNumberUnit(raw: string, unitWord: string): number | null {
  const m = new RegExp(`^(\\d{1,2})${unitWord}$`).exec(raw);
  return m ? Number(m[1]) : null;
}

export function extractRoomsAndBeds(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
): RoomsAndBedsExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  let minRooms: number | undefined;
  let maxRooms: number | undefined;
  let minBeds: number | undefined;
  let maxBeds: number | undefined;

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

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
        const before = numberBeforeUnit(tokens, i);
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

  // ── Chambres (beds) : "2 chambres" / "2 bedrooms" / "2br" / "2 ch" ───
  // Valeurs "exactes" (sans qualificatif) : collectées d'abord, décidées
  // après coup — si plusieurs valeurs distinctes apparaissent dans la même
  // requête ("3 chambres, 2 bedrooms"), c'est un conflit : on ne fixe pas
  // minBeds/maxBeds (même principe que type/transaction), mais les tokens
  // restent marqués consumed (compris, juste contradictoire).
  const exactMatches: Array<{ value: number }> = [];

  for (const dict of dictionaries) {
    for (const unit of dict.beds.unitWords) {
      // Forme collée ("2br").
      for (let i = 0; i < tokens.length; i++) {
        if (blocked(i, i + 1)) continue;
        const n = glueNumberUnit(tokens[i].raw, unit);
        if (n === null) continue;
        applyBeds(i, i + 1, n);
      }
      // Forme séparée ("2 chambres" / "2 bedrooms").
      for (let i = 0; i < tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, unit);
        if (!len || blocked(i, i + len)) continue;
        const before = numberBeforeUnit(tokens, i);
        if (!before) continue;
        const [n, s] = before;
        if (blocked(s, i + len)) continue;
        applyBeds(s, i + len, n);
      }
    }
  }

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

  return { minRooms, maxRooms, minBeds, maxBeds, consumed, matchedSpans };
}
