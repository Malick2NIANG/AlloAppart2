import { ListingType } from '@prisma/client';
import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';

export interface TypeExtraction {
  type?: ListingType;
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
 * Type de bien. CHAMBRE n'est JAMAIS déduit du mot « chambre » seul (qui
 * sert aussi au nombre de chambres, lot « beds ») — seulement des phrases
 * figées du dictionnaire (« chambre à louer/meublée/individuelle »,
 * « room for rent »/« single room »). Si plusieurs types différents sont
 * trouvés dans la même requête, aucun n'est retenu (ambiguïté — signalé
 * dans le rapport du lot 1b), mais leurs mentions restent "consommées"
 * (ne polluent pas unmatchedTokens, le texte a bien été compris, juste
 * en conflit).
 */
export function extractType(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
): TypeExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const found = new Set<ListingType>();

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  for (const dict of dictionaries) {
    // Phrases figées "chambre à louer" etc. → CHAMBRE, avant le mot seul.
    for (const phrase of dict.chambrePhrases) {
      const words = phrase.split(' ');
      for (let i = 0; i + words.length <= tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, phrase);
        if (!len || blocked(i, i + len)) continue;
        found.add(ListingType.CHAMBRE);
        for (let k = i; k < i + len; k++) consumed.add(k);
        matchedSpans.push({
          category: 'type',
          text: phrase,
          value: ListingType.CHAMBRE,
        });
      }
    }

    for (const [type, keywords] of Object.entries(dict.type) as [
      ListingType,
      string[],
    ][]) {
      for (const kw of keywords) {
        const words = kw.split(' ');
        for (let i = 0; i + words.length <= tokens.length; i++) {
          const len = matchPhraseAt(tokens, i, kw);
          if (!len || blocked(i, i + len)) continue;
          found.add(type);
          for (let k = i; k < i + len; k++) consumed.add(k);
          matchedSpans.push({ category: 'type', text: kw, value: type });
        }
      }
    }
  }

  if (found.size === 1) {
    return { type: [...found][0], consumed, matchedSpans };
  }
  // 0 ou plusieurs types trouvés : rien à retenir (0 = pas de match ;
  // >1 = conflit, règle explicite "n'extrais aucun type").
  return { type: undefined, consumed, matchedSpans };
}
