import { TransactionType } from '@prisma/client';
import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';

export interface TransactionExtraction {
  transactionType?: TransactionType;
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

/** LOCATION et VENTE tous les deux présents → aucun des deux n'est retenu
 * (ambiguïté explicite, règle du lot 1b) ; les mentions restent
 * consommées (comprises mais en conflit, pas "non comprises"). */
export function extractTransaction(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
): TransactionExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const found = new Set<TransactionType>();

  const blocked = (s: number, e: number) =>
    isRangeConsumed(s, e, alreadyConsumed) || isRangeConsumed(s, e, consumed);

  for (const dict of dictionaries) {
    for (const [txType, keywords] of Object.entries(dict.transaction) as [
      TransactionType,
      string[],
    ][]) {
      for (const kw of keywords) {
        const words = kw.split(' ');
        for (let i = 0; i + words.length <= tokens.length; i++) {
          const len = matchPhraseAt(tokens, i, kw);
          if (!len || blocked(i, i + len)) continue;
          found.add(txType);
          for (let k = i; k < i + len; k++) consumed.add(k);
          matchedSpans.push({
            category: 'transaction',
            text: kw,
            value: txType,
          });
        }
      }
    }
  }

  if (found.size === 1) {
    return { transactionType: [...found][0], consumed, matchedSpans };
  }
  return { transactionType: undefined, consumed, matchedSpans };
}
