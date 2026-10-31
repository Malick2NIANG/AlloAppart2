import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import { isWordMatch } from '../normalize';

export interface AmenitiesExtraction {
  amenities: string[];
  /** Équipements reconnus mais précédés/suivis d'un mot de préférence ("de
   * préférence", "idéalement", "preferably"…) — classent les résultats,
   * n'excluent jamais une annonce (lot 7, règle 4). Même clé canonique que
   * `amenities`, jamais les deux à la fois pour la même mention. */
  softAmenities: string[];
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

/** Un marqueur de préférence (une seule des deux langues suffit, comme pour
 * les autres catégories) est-il proche du span [start,end) ? Fenêtre courte
 * (3 tokens) plutôt qu'une adjacence stricte — tolère un connecteur court
 * entre les deux ("idéalement avec parking", "with pool, preferably"). */
function hasAdjacentPreferenceMarker(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  start: number,
  end: number,
): boolean {
  const WINDOW = 3;
  for (const dict of dictionaries) {
    for (const marker of dict.preferenceMarkers) {
      const words = marker.split(' ');
      for (let k = end; k <= end + WINDOW; k++) {
        if (matchPhraseAt(tokens, k, marker) === words.length) return true;
      }
      for (
        let k = start - words.length;
        k >= start - words.length - WINDOW;
        k--
      ) {
        if (k >= 0 && matchPhraseAt(tokens, k, marker) === words.length) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Équipements → clés canoniques de Frontend/src/lib/listingProfile.ts
 * (dupliquées dans dictionaries/amenityKeys.ts). Tolérance aux fautes sur
 * les synonymes d'un seul mot (≥ 6 caractères) ; correspondance exacte
 * pour les synonymes à plusieurs mots (ex. "groupe electrogene").
 */
export function extractAmenities(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
): AmenitiesExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const found = new Set<string>();
  const foundSoft = new Set<string>();

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  function record(key: string, s: number, e: number, text: string) {
    const soft = hasAdjacentPreferenceMarker(tokens, dictionaries, s, e);
    if (soft) foundSoft.add(key);
    else found.add(key);
    for (let k = s; k < e; k++) consumed.add(k);
    matchedSpans.push({ category: 'amenity', text, value: key });
  }

  for (const dict of dictionaries) {
    for (const [key, synonyms] of Object.entries(dict.amenities)) {
      for (const syn of synonyms) {
        const words = syn.split(' ');
        if (words.length > 1) {
          for (let i = 0; i + words.length <= tokens.length; i++) {
            const len = matchPhraseAt(tokens, i, syn);
            if (!len || blocked(i, i + len)) continue;
            record(key, i, i + len, syn);
          }
        } else {
          for (let i = 0; i < tokens.length; i++) {
            if (blocked(i, i + 1)) continue;
            if (!isWordMatch(tokens[i].raw, syn)) continue;
            record(key, i, i + 1, tokens[i].raw);
          }
        }
      }
    }
  }

  // Une clé comprise à la fois en filtre strict et en préférence douce
  // (deux mentions différentes) : la préférence douce s'efface, le filtre
  // strict prime (règle de prudence — mieux vaut un filtre réel qu'un flou).
  for (const key of found) foundSoft.delete(key);

  return {
    amenities: [...found],
    softAmenities: [...foundSoft],
    consumed,
    matchedSpans,
  };
}
