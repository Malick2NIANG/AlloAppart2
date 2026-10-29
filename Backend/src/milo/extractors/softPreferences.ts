import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import { isWordMatch } from '../normalize';

export interface SoftPreferencesExtraction {
  softPreferences: string[];
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

/** Préférences floues → identifiants stables (near_sea, quiet, upscale…),
 * jamais un filtre strict — ne font que classer les résultats (Meilisearch,
 * lot 6), jamais en exclure. */
export function extractSoftPreferences(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
): SoftPreferencesExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const found = new Set<string>();

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  for (const dict of dictionaries) {
    for (const [id, synonyms] of Object.entries(dict.softPreferences)) {
      for (const syn of synonyms) {
        const words = syn.split(' ');
        if (words.length > 1) {
          for (let i = 0; i + words.length <= tokens.length; i++) {
            const len = matchPhraseAt(tokens, i, syn);
            if (!len || blocked(i, i + len)) continue;
            found.add(id);
            for (let k = i; k < i + len; k++) consumed.add(k);
            matchedSpans.push({
              category: 'softPreference',
              text: syn,
              value: id,
            });
          }
        } else {
          for (let i = 0; i < tokens.length; i++) {
            if (blocked(i, i + 1)) continue;
            if (!isWordMatch(tokens[i].raw, syn)) continue;
            found.add(id);
            consumed.add(i);
            matchedSpans.push({
              category: 'softPreference',
              text: tokens[i].raw,
              value: id,
            });
          }
        }
      }
    }
  }

  return { softPreferences: [...found], consumed, matchedSpans };
}
