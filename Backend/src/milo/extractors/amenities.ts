import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import { isWordMatch } from '../normalize';

export interface AmenitiesExtraction {
  amenities: string[];
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

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  for (const dict of dictionaries) {
    for (const [key, synonyms] of Object.entries(dict.amenities)) {
      for (const syn of synonyms) {
        const words = syn.split(' ');
        if (words.length > 1) {
          for (let i = 0; i + words.length <= tokens.length; i++) {
            const len = matchPhraseAt(tokens, i, syn);
            if (!len || blocked(i, i + len)) continue;
            found.add(key);
            for (let k = i; k < i + len; k++) consumed.add(k);
            matchedSpans.push({ category: 'amenity', text: syn, value: key });
          }
        } else {
          for (let i = 0; i < tokens.length; i++) {
            if (blocked(i, i + 1)) continue;
            if (!isWordMatch(tokens[i].raw, syn)) continue;
            found.add(key);
            consumed.add(i);
            matchedSpans.push({
              category: 'amenity',
              text: tokens[i].raw,
              value: key,
            });
          }
        }
      }
    }
  }

  return { amenities: [...found], consumed, matchedSpans };
}
