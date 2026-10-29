import type { LanguageDictionary, MiloMatchedSpan } from '../types';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';

/** Mots qui, juste après un nombre, en excluent toujours la lecture comme
 * un prix (le nombre appartient à une autre catégorie : pièces, chambres,
 * surface). Les deux langues sont vérifiées ensemble (dictionnaires
 * appliqués ensemble, règle du lot 1b). */
const FORBIDDEN_FOLLOW_WORDS = [
  'pieces',
  'piece',
  'rooms',
  'room',
  'chambres',
  'chambre',
  'ch',
  'bedrooms',
  'bedroom',
  'bed',
  'beds',
  'br',
  'm²',
  'm2',
];

interface NumberCandidate {
  value: number;
  start: number; // indice du premier token consommé
  end: number; // indice exclusif du dernier token consommé
  hasMultiplier: boolean;
  /** Facteur multiplicateur effectif (1 000 ou 1 000 000) — permet de le
   * "prêter" à un nombre voisin dans un intervalle qui le partage
   * implicitement (ex. "entre 80 et 120 millions" : 80 hérite de millions). */
  multiplierFactor?: number;
  hasCurrency: boolean;
}

function parseIntSafe(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Un candidat < 1000 sans multiplicateur ni devise n'est jamais un prix
 * utilisable seul (règle explicite du lot 1b). */
function isUsableAlone(c: NumberCandidate): boolean {
  return c.value >= 1000 || c.hasMultiplier || c.hasCurrency;
}

/** Détecte tous les nombres "en forme de prix" dans la liste de tokens —
 * fusionne les groupes de milliers ("350 000"), gère k/m/million(s),
 * rejette ce qui suit un mot-unité interdit (pièces/chambres/m²). Ne
 * rejette PAS ici les petits nombres sans multiplicateur : certains ne
 * sont utilisables qu'en paire dans un intervalle qui partage son
 * multiplicateur (voir `isUsableAlone`, appliqué au bon endroit). */
function findNumberCandidates(
  tokens: Token[],
  multipliers: Record<string, number>,
  currencyWords: string[],
): NumberCandidate[] {
  const candidates: NumberCandidate[] = [];
  let i = 0;
  while (i < tokens.length) {
    const raw = tokens[i].raw;
    let value: number | null = null;
    let end = i + 1;
    let hasMultiplier = false;
    let multiplierFactor: number | undefined;

    // "350k" / "1.5m" — suffixe multiplicateur collé au nombre.
    const suffixMatch = /^(\d+(?:[.,]\d+)?)(k|m)$/.exec(raw);
    if (suffixMatch) {
      const base = Number(suffixMatch[1].replace(',', '.'));
      const mult = multipliers[suffixMatch[2]];
      if (Number.isFinite(base) && mult) {
        value = base * mult;
        hasMultiplier = true;
        multiplierFactor = mult;
      }
    }

    // "350.000" — points comme séparateurs de milliers (groupes de 3).
    if (value === null && /^\d{1,3}(\.\d{3})+$/.test(raw)) {
      value = parseIntSafe(raw.replace(/\./g, ''));
    }

    // "1,5" ou "2" suivi du mot million/millions (FR et EN partagent le mot).
    if (value === null && /^\d+(?:,\d+)?$/.test(raw)) {
      const next = tokens[i + 1]?.raw;
      if (next === 'million' || next === 'millions') {
        const base = Number(raw.replace(',', '.'));
        if (Number.isFinite(base)) {
          const mult = multipliers.million ?? 1_000_000;
          value = base * mult;
          hasMultiplier = true;
          multiplierFactor = mult;
          end = i + 2;
        }
      }
    }

    // Nombre nu (fusion des groupes de milliers suivants, "350" "000"...).
    if (value === null && /^\d+$/.test(raw)) {
      value = parseIntSafe(raw);
      let j = end;
      while (j < tokens.length && /^\d{3}$/.test(tokens[j].raw)) {
        value = (value ?? 0) * 1000 + Number(tokens[j].raw);
        j++;
      }
      end = j;
    }

    if (value !== null) {
      // Rejet définitif : un nombre suivi d'un mot-unité pièces/chambres/m²
      // n'est jamais un prix (appartient à une autre catégorie).
      const followWord = tokens[end]?.raw;
      if (followWord && FORBIDDEN_FOLLOW_WORDS.includes(followWord)) {
        i = i + 1;
        continue;
      }

      // Devise juste après (étend le span, autorise les petits montants).
      let hasCurrency = false;
      if (followWord && currencyWords.includes(followWord)) {
        hasCurrency = true;
        end = end + 1;
      }

      candidates.push({
        value,
        start: i,
        end,
        hasMultiplier,
        multiplierFactor,
        hasCurrency,
      });
      i = end;
      continue;
    }

    i++;
  }
  return candidates;
}

export interface PriceExtraction {
  minPrice?: number;
  maxPrice?: number;
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
}

/**
 * Règle directrice : un montant sans mot-clé de borne (moins de/sous/
 * budget/under/between…) n'est jamais extrait — il reste dans
 * `unmatchedTokens` (en cas de doute, ne pas extraire).
 */
export function extractPrice(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
): PriceExtraction {
  const multipliers: Record<string, number> = {};
  const currencyWords: string[] = [];
  for (const dict of dictionaries) {
    Object.assign(multipliers, dict.price.multipliers);
    currencyWords.push(...dict.price.currencyWords);
  }

  const allCandidates = findNumberCandidates(
    tokens,
    multipliers,
    currencyWords,
  );
  const availableCandidates = allCandidates.filter(
    (c) => !isRangeConsumed(c.start, c.end, alreadyConsumed),
  );

  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const claimed = new Set<NumberCandidate>();
  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  function nearestUnclaimed(
    fromIndex: number,
    requireUsableAlone: boolean,
  ): NumberCandidate | undefined {
    let best: NumberCandidate | undefined;
    for (const c of availableCandidates) {
      if (claimed.has(c)) continue;
      if (c.start < fromIndex) continue;
      if (c.start - fromIndex > 4) continue; // fenêtre de recherche courte
      if (requireUsableAlone && !isUsableAlone(c)) continue;
      if (!best || c.start < best.start) best = c;
    }
    return best;
  }

  function markSpan(start: number, end: number) {
    for (let k = start; k < end; k++) consumed.add(k);
  }

  for (const dict of dictionaries) {
    // "entre X et Y" / "between X and Y" — en premier : X peut être un
    // petit nombre qui hérite du multiplicateur de Y ("entre 80 et 120
    // millions" → les deux en millions), donc on cherche ici SANS exiger
    // `isUsableAlone` pour le premier nombre.
    for (const { start, mid } of dict.price.betweenKeywords) {
      for (let i = 0; i + 1 <= tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, start);
        if (!len || isRangeConsumed(i, i + len, alreadyConsumed)) continue;
        const first = nearestUnclaimed(i + len, false);
        if (!first) continue;
        const midLen = matchPhraseAt(tokens, first.end, mid);
        if (!midLen) continue;
        const second = nearestUnclaimed(first.end + midLen, false);
        if (!second) continue;

        let firstValue = first.value;
        let secondValue = second.value;
        if (
          !first.hasMultiplier &&
          !first.hasCurrency &&
          second.hasMultiplier
        ) {
          firstValue = first.value * (second.multiplierFactor ?? 1);
        } else if (
          !second.hasMultiplier &&
          !second.hasCurrency &&
          first.hasMultiplier
        ) {
          secondValue = second.value * (first.multiplierFactor ?? 1);
        }
        // Sans multiplicateur partagé ni propre, les deux bornes doivent
        // rester individuellement plausibles comme prix (règle < 1000).
        const firstOk =
          first.hasMultiplier || first.hasCurrency || firstValue >= 1000;
        const secondOk =
          second.hasMultiplier || second.hasCurrency || secondValue >= 1000;
        if (!firstOk || !secondOk) continue;

        claimed.add(first);
        claimed.add(second);
        const lo = Math.min(firstValue, secondValue);
        const hi = Math.max(firstValue, secondValue);
        minPrice = lo;
        maxPrice = hi;
        markSpan(i, i + len);
        markSpan(first.start, first.end);
        markSpan(first.end, first.end + midLen);
        markSpan(second.start, second.end);
        matchedSpans.push({
          category: 'price',
          text: `${start} ${firstValue} ${mid} ${secondValue}`,
          value: `${lo}-${hi}`,
        });
      }
    }

    for (const kw of dict.price.maxKeywords) {
      for (let i = 0; i + 1 <= tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, kw);
        if (!len || isRangeConsumed(i, i + len, alreadyConsumed)) continue;
        const cand = nearestUnclaimed(i + len, true);
        if (!cand) continue;
        claimed.add(cand);
        maxPrice =
          maxPrice === undefined ? cand.value : Math.min(maxPrice, cand.value);
        markSpan(i, i + len);
        markSpan(cand.start, cand.end);
        matchedSpans.push({
          category: 'price',
          text: `${kw} ${cand.value}`,
          value: String(cand.value),
        });
      }
    }

    for (const kw of dict.price.minKeywords) {
      for (let i = 0; i + 1 <= tokens.length; i++) {
        const len = matchPhraseAt(tokens, i, kw);
        if (!len || isRangeConsumed(i, i + len, alreadyConsumed)) continue;
        const cand = nearestUnclaimed(i + len, true);
        if (!cand) continue;
        claimed.add(cand);
        minPrice =
          minPrice === undefined ? cand.value : Math.max(minPrice, cand.value);
        markSpan(i, i + len);
        markSpan(cand.start, cand.end);
        matchedSpans.push({
          category: 'price',
          text: `${kw} ${cand.value}`,
          value: String(cand.value),
        });
      }
    }
  }

  return { minPrice, maxPrice, consumed, matchedSpans };
}

function isRangeConsumed(
  start: number,
  end: number,
  consumed: ReadonlySet<number>,
): boolean {
  for (let k = start; k < end; k++) if (consumed.has(k)) return true;
  return false;
}
