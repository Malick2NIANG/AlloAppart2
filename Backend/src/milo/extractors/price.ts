import type {
  LanguageDictionary,
  MiloAmbiguity,
  MiloMatchedSpan,
} from '../types';
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

    // "12,000,000" / "30,000" — virgules comme séparateurs de milliers,
    // forme anglo-saxonne (lot 7, règle 2). Groupes STRICTEMENT à 3
    // chiffres après chaque virgule : "1,5" (décimal) n'a qu'un chiffre
    // après la virgule et ne matche jamais ce motif.
    if (value === null && /^\d{1,3}(,\d{3})+$/.test(raw)) {
      value = parseIntSafe(raw.replace(/,/g, ''));
    }

    // "1,5" ou "2" suivi d'un mot-multiplicateur écrit : million(s) (FR/EN
    // partagent le mot), ou "mille" = x1000 (FR, "100 mille"/"400 mille" —
    // lot 7, règle 2). Jamais "k"/"m" ici (suffixe collé, forme à part
    // ci-dessus) : liste explicite, pas tout `multipliers`.
    if (value === null && /^\d+(?:,\d+)?$/.test(raw)) {
      const next = tokens[i + 1]?.raw;
      const WORD_MULTIPLIERS = ['million', 'millions', 'mille'];
      if (next && WORD_MULTIPLIERS.includes(next)) {
        const base = Number(raw.replace(',', '.'));
        if (Number.isFinite(base)) {
          const mult =
            next === 'mille' ? 1_000 : (multipliers.million ?? 1_000_000);
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
      // "300 K" / "80 M" — suffixe multiplicateur SÉPARÉ par un espace,
      // propre token (vs "300k" collé, § suffixMatch ci-dessus — lot 7,
      // règle 2 : les deux graphies sont requises).
      const sep = tokens[end]?.raw;
      if (sep && (sep === 'k' || sep === 'm') && multipliers[sep]) {
        const mult = multipliers[sep];
        value = (value ?? 0) * mult;
        hasMultiplier = true;
        multiplierFactor = mult;
        end = end + 1;
      }
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

/** "200k-300k" / "200000-300000" — un seul token, tiret interne (la
 * normalisation NE retire PAS le tiret, lot 7 règle 2 fourchettes). Les
 * deux côtés doivent chacun ressembler à un montant (nombre nu ≥ 1000, ou
 * suffixe k/m) — un tiret entre deux petits nombres n'est jamais une
 * fourchette de prix (ex. "F3-F4" reste géré ailleurs). */
function parseHyphenRange(
  raw: string,
  multipliers: Record<string, number>,
): { lo: number; hi: number } | null {
  const m = /^(\d+(?:[.,]\d+)?)(k|m)?-(\d+(?:[.,]\d+)?)(k|m)?$/.exec(raw);
  if (!m) return null;
  const [, n1, suf1, n2, suf2] = m;
  const parseOne = (n: string, suf: string | undefined): number | null => {
    const base = Number(n.replace(',', '.'));
    if (!Number.isFinite(base)) return null;
    if (suf) {
      const mult = multipliers[suf];
      return mult ? base * mult : null;
    }
    return base;
  };
  let v1 = parseOne(n1, suf1);
  let v2 = parseOne(n2, suf2);
  if (v1 === null || v2 === null) return null;
  // Un seul côté porte le suffixe k/m ("200-300k") : l'autre l'hérite,
  // même principe que "entre 80 et 120 millions" pour les mots-clés.
  if (!suf1 && suf2) v1 = v1 * (multipliers[suf2] ?? 1);
  if (!suf2 && suf1) v2 = v2 * (multipliers[suf1] ?? 1);
  if (v1 < 1000 && v2 < 1000) return null;
  return { lo: Math.min(v1, v2), hi: Math.max(v1, v2) };
}

/** Un mot-clé de période (FR/EN) est-il immédiatement adjacent au candidat
 * (juste avant son `start`, ou juste après son `end`) ? Adjacence stricte
 * uniquement — une durée de location mentionnée ailleurs dans la phrase
 * ("à l'année", "for one week") ne doit jamais bloquer un montant qui n'a
 * aucun rapport avec elle (lot 7, règle 1.a). */
function adjacentPhrase(
  tokens: Token[],
  candidate: NumberCandidate,
  phrases: string[],
): boolean {
  for (const phrase of phrases) {
    const words = phrase.split(' ');
    if (matchPhraseAt(tokens, candidate.end, phrase) === words.length) {
      return true;
    }
    const from = candidate.start - words.length;
    if (from >= 0 && matchPhraseAt(tokens, from, phrase) === words.length) {
      return true;
    }
  }
  return false;
}

export interface PriceExtraction {
  minPrice?: number;
  maxPrice?: number;
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
  ambiguities: MiloAmbiguity[];
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
  const nonMonthlyPeriodKeywords: string[] = [];
  const monthlyPeriodKeywords: string[] = [];
  const approximateKeywords: string[] = [];
  for (const dict of dictionaries) {
    Object.assign(multipliers, dict.price.multipliers);
    currencyWords.push(...dict.price.currencyWords);
    nonMonthlyPeriodKeywords.push(...dict.price.nonMonthlyPeriodKeywords);
    monthlyPeriodKeywords.push(...dict.price.monthlyPeriodKeywords);
    approximateKeywords.push(...dict.price.approximateKeywords);
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
  const ambiguities: MiloAmbiguity[] = [];
  const claimed = new Set<NumberCandidate>();
  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  // Une période NON mensuelle adjacente bloque DÉFINITIVEMENT le candidat —
  // avant même de regarder les mots-clés de direction (règle 1.a : jamais
  // un prix, quel que soit le reste du contexte). Une période mensuelle
  // explicite adjacente n'a aucun effet (unité par défaut).
  const periodBlocked = new Set<NumberCandidate>();
  for (const c of availableCandidates) {
    if (adjacentPhrase(tokens, c, monthlyPeriodKeywords)) continue;
    if (adjacentPhrase(tokens, c, nonMonthlyPeriodKeywords)) {
      periodBlocked.add(c);
    }
  }

  function nearestUnclaimed(
    fromIndex: number,
    requireUsableAlone: boolean,
  ): NumberCandidate | undefined {
    let best: NumberCandidate | undefined;
    for (const c of availableCandidates) {
      if (claimed.has(c) || periodBlocked.has(c)) continue;
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

  // ── Fourchettes "200k-300k" (tiret, un seul token) — avant tout le reste,
  // indépendant des mots-clés de direction. `findNumberCandidates` ne
  // reconnaît pas ce token (le tiret casse ses regex) : on scanne les
  // tokens bruts directement, pas `availableCandidates`. ─────────────────
  for (let i = 0; i < tokens.length; i++) {
    if (isRangeConsumed(i, i + 1, alreadyConsumed) || consumed.has(i)) continue;
    let range = parseHyphenRange(tokens[i].raw, multipliers);
    let wordMultiplierLen = 0;
    if (!range) {
      // "80-120 millions" — tiret SANS suffixe collé de chaque côté, mot
      // multiplicateur partagé juste après (lot 7, règle 2 : même principe
      // que "entre 80 et 120 millions" côté mots-clés).
      const bare = /^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/.exec(tokens[i].raw);
      const next = tokens[i + 1]?.raw;
      if (bare && next && ['million', 'millions', 'mille'].includes(next)) {
        const mult =
          next === 'mille' ? 1_000 : (multipliers.million ?? 1_000_000);
        const v1 = Number(bare[1].replace(',', '.')) * mult;
        const v2 = Number(bare[2].replace(',', '.')) * mult;
        if (Number.isFinite(v1) && Number.isFinite(v2)) {
          range = { lo: Math.min(v1, v2), hi: Math.max(v1, v2) };
          wordMultiplierLen = 1;
        }
      }
    }
    if (!range) continue;
    if (wordMultiplierLen && isRangeConsumed(i + 1, i + 2, alreadyConsumed))
      continue;
    minPrice = range.lo;
    maxPrice = range.hi;
    markSpan(i, i + 1 + wordMultiplierLen);
    matchedSpans.push({
      category: 'price',
      text: tokens[i].raw,
      value: `${range.lo}-${range.hi}`,
    });
  }

  // ── Montants approximatifs (environ/autour de/vers/~) — maxPrice + 10 %,
  // jamais minPrice. Deux garde-fous (lot 7, correction ciblée) :
  // 1) le marqueur doit être ADJACENT au montant, collé sans aucun mot
  //    entre les deux — "vers Keur Massar, 150.000 max" : "vers" n'est
  //    jamais collé à "150.000" (le lieu s'intercale), jamais lu comme
  //    approximatif ; "vers + lieu" reste une préposition de lieu (règle
  //    2). Testé aussi : "villa vers Saly 80M max" — un lieu intercalé
  //    entre le marqueur et le montant, même à 1 seul mot, suffit à
  //    réintroduire le bug d'origine, d'où une adjacence STRICTE (0 mot)
  //    plutôt que la tolérance d'1 mot envisagée au départ ;
  // 2) un mot-clé de direction ATTACHÉ au même montant (prefixe ou
  //    suffixe) annule l'approximation — "environ 150k max" reste 150000
  //    exact, pas de majoration.
  const ADJACENT_GAP = 0; // aucun mot entre le marqueur et le montant
  function directionKeywordAttached(cand: NumberCandidate): boolean {
    for (const dict of dictionaries) {
      for (const kw of [...dict.price.maxKeywords, ...dict.price.minKeywords]) {
        const words = kw.split(' ');
        const from = cand.start - words.length;
        if (from >= 0 && matchPhraseAt(tokens, from, kw) === words.length) {
          return true;
        }
        for (
          let i = cand.end;
          i <= Math.min(cand.end + 4, tokens.length);
          i++
        ) {
          if (matchPhraseAt(tokens, i, kw) === words.length) return true;
        }
      }
    }
    return false;
  }
  for (const kw of approximateKeywords) {
    for (let i = 0; i + 1 <= tokens.length; i++) {
      const len = matchPhraseAt(tokens, i, kw);
      if (!len || isRangeConsumed(i, i + len, alreadyConsumed)) continue;
      // Préfixe ("environ 150k") : montant à 0 ou 1 mot après le marqueur.
      let cand = availableCandidates.find(
        (c) =>
          !claimed.has(c) &&
          !periodBlocked.has(c) &&
          isUsableAlone(c) &&
          c.start >= i + len &&
          c.start <= i + len + ADJACENT_GAP,
      );
      // Suffixe ("150k environ") : marqueur à 0 ou 1 mot après le montant.
      if (!cand) {
        cand = availableCandidates.find(
          (c) =>
            !claimed.has(c) &&
            !periodBlocked.has(c) &&
            isUsableAlone(c) &&
            c.end <= i &&
            c.end + ADJACENT_GAP >= i,
        );
      }
      if (!cand) continue;
      if (directionKeywordAttached(cand)) continue; // garde-fou 2 : direction explicite, pas d'approximation
      claimed.add(cand);
      const raised = cand.value * 1.1;
      const rounded =
        raised >= 1000 ? Math.round(raised / 1000) * 1000 : Math.round(raised);
      maxPrice = maxPrice === undefined ? rounded : Math.min(maxPrice, rounded);
      ambiguities.push('approximateAmount');
      markSpan(i, i + len);
      markSpan(cand.start, cand.end);
      matchedSpans.push({
        category: 'price',
        text: `${kw} ${cand.value}`,
        value: `~${rounded}`,
      });
    }
  }

  for (const dict of dictionaries) {
    // "entre X et Y" / "between X and Y" / "from X to Y" — en premier : X
    // peut être un petit nombre qui hérite du multiplicateur de Y ("entre
    // 80 et 120 millions" → les deux en millions), donc on cherche ici SANS
    // exiger `isUsableAlone` pour le premier nombre.
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

  // ── Mot-clé de direction APRÈS le montant ("300k maximum", "80M min")
  // — même règle, sens inverse (règle 2 : "suivi OU précédé" s'applique
  // aussi à la direction, pas seulement aux périodes). Une courte fenêtre
  // (4 tokens) tolère un mot de période entre les deux ("300k par mois
  // maximum"). Essayé seulement pour les candidats encore libres : un
  // montant déjà résolu par un mot-clé en préfixe n'est pas rouvert. ─────
  for (const dict of dictionaries) {
    for (const cand of availableCandidates) {
      if (claimed.has(cand) || periodBlocked.has(cand)) continue;
      let matchedMax: { i: number; len: number; kw: string } | undefined;
      let matchedMin: { i: number; len: number; kw: string } | undefined;
      for (let i = cand.end; i <= Math.min(cand.end + 4, tokens.length); i++) {
        if (!matchedMax) {
          for (const kw of dict.price.maxKeywords) {
            const len = matchPhraseAt(tokens, i, kw);
            if (len && !isRangeConsumed(i, i + len, alreadyConsumed)) {
              matchedMax = { i, len, kw };
              break;
            }
          }
        }
        if (!matchedMax && !matchedMin) {
          for (const kw of dict.price.minKeywords) {
            const len = matchPhraseAt(tokens, i, kw);
            if (len && !isRangeConsumed(i, i + len, alreadyConsumed)) {
              matchedMin = { i, len, kw };
              break;
            }
          }
        }
        if (matchedMax || matchedMin) break;
      }
      if (matchedMax) {
        claimed.add(cand);
        maxPrice =
          maxPrice === undefined ? cand.value : Math.min(maxPrice, cand.value);
        markSpan(cand.start, cand.end);
        markSpan(matchedMax.i, matchedMax.i + matchedMax.len);
        matchedSpans.push({
          category: 'price',
          text: `${cand.value} ${matchedMax.kw}`,
          value: String(cand.value),
        });
      } else if (matchedMin) {
        claimed.add(cand);
        minPrice =
          minPrice === undefined ? cand.value : Math.max(minPrice, cand.value);
        markSpan(cand.start, cand.end);
        markSpan(matchedMin.i, matchedMin.i + matchedMin.len);
        matchedSpans.push({
          category: 'price',
          text: `${cand.value} ${matchedMin.kw}`,
          value: String(cand.value),
        });
      }
    }
  }

  // ── Montants compris mais sans filtre posé — ambiguïtés (lot 7) ───────
  // Période non mensuelle adjacente : toujours signalé si le montant
  // ressemblait à un prix (multiplicateur/devise/≥1000), qu'un mot-clé de
  // direction ait été présent ou non — jamais extrait, jamais silencieux.
  for (const c of periodBlocked) {
    if (isUsableAlone(c)) ambiguities.push('periodNotSupported');
  }
  // Montant plausible, jamais réclamé par une fourchette/approximatif/
  // direction : compris mais la direction (min ou max ?) reste inconnue.
  for (const c of availableCandidates) {
    if (claimed.has(c) || periodBlocked.has(c)) continue;
    if (isUsableAlone(c)) ambiguities.push('amountDirection');
  }

  return { minPrice, maxPrice, consumed, matchedSpans, ambiguities };
}

function isRangeConsumed(
  start: number,
  end: number,
  consumed: ReadonlySet<number>,
): boolean {
  for (let k = start; k < end; k++) if (consumed.has(k)) return true;
  return false;
}
