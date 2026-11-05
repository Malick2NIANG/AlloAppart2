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
  // Surface (lot 7 bis, règle A) — un nombre collé à une unité de surface
  // n'est jamais un prix ("1500 square meters" ≥ 1000 serait sinon un
  // candidat utilisable seul). "m2"/"m²" déjà au-dessus.
  'metre',
  'metres',
  'metres²',
  'square',
  'feet',
  'sqm',
  'ha',
  'hectare',
  'hectares',
  // Personnes (règle A) — "8 personnes" n'est jamais un prix ni un nombre
  // de chambres.
  'personne',
  'personnes',
  'people',
  'persons',
  'pax',
  'adultes',
  'adulte',
  'enfants',
  'enfant',
  // Formes EN manquantes (lot 7 ter) — "adulte(s)"/"enfant(s)" avaient
  // leur pendant EN oublié.
  'adult',
  'adults',
  'child',
  'children',
];

/** Mots-clés de direction grammaticalement valables APRÈS le montant
 * ("300k maximum") — liste restreinte et volontairement plus courte que
 * `maxKeywords`/`minKeywords` : "budget"/"moins de"/"jusqu'à"/"under"/
 * "up to"… ne se disent jamais après le nombre ("3 budget" n'a aucun
 * sens) et feraient sinon remonter un nombre sans rapport à 4 tokens de
 * là (lot 7 bis, bug découvert sur "... budget 25mil/nuit" où "budget"
 * en suffixe happait un "3" bien antérieur dans la phrase). */
const POSTFIX_ELIGIBLE = new Set([
  'maximum',
  'max',
  'au plus',
  'minimum',
  'min',
  'au moins',
  'at most',
  'at least',
]);

/** Mot central nu pour une fourchette sans mot-clé introductif ("70 à 85
 * millions", lot 7 bis, règle D) — "a" = "à" (accents retirés), "-" = tiret
 * isolé (espaces autour, "–"/"—" déjà normalisés en "-" par normalize.ts). */
const RANGE_BARE_MID_WORDS = ['a', 'to', '-'];

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

/**
 * Nombres en lettres FR/EN (lot 7 bis, règle F — seulement après A-E,
 * "simple et sûr" : un analyseur composé borné, pas une liste à plat de
 * 1 à 999). "quatre-vingt-dix" reste UN token (le tiret n'est pas un
 * séparateur, normalize.ts), donc une entrée directe dans les dictionnaires
 * tens/teens/units suffit — pas besoin de recomposer "quatre"+"vingt"+"dix".
 * En cas de doute (mot inconnu, ordre inattendu) : aucun match, le texte
 * reste un mot non compris (jamais de valeur devinée).
 */
const FR_UNITS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
};
const FR_TENS_TEENS_UNITS: Record<string, number> = {
  ...FR_UNITS,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  'dix-sept': 17,
  'dix-huit': 18,
  'dix-neuf': 19,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  'soixante-dix': 70,
  'quatre-vingt': 80,
  'quatre-vingts': 80,
  'quatre-vingt-dix': 90,
};
const EN_UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const EN_TENS_TEENS_UNITS: Record<string, number> = {
  ...EN_UNITS,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

interface WrittenNumberMatch {
  value: number;
  end: number;
  /** Un mot-multiplicateur (cent/mille/million…) a participé — compte comme
   * `hasMultiplier` pour `isUsableAlone` (même traitement que "k"/"m"). */
  hasMultiplier: boolean;
}

function parseWrittenNumber(
  tokens: Token[],
  start: number,
): WrittenNumberMatch | null {
  for (const [
    units,
    tensTeensUnits,
    hundredWords,
    thousandWord,
    millionWords,
  ] of [
    [
      FR_UNITS,
      FR_TENS_TEENS_UNITS,
      ['cent', 'cents'],
      'mille',
      ['million', 'millions'],
    ],
    [
      EN_UNITS,
      EN_TENS_TEENS_UNITS,
      ['hundred'],
      'thousand',
      ['million', 'millions'],
    ],
  ] as const) {
    let i = start;
    let value = 0;
    let hasMultiplier = false;
    let matched = false;

    const first = tokens[i]?.raw;
    const second = tokens[i + 1]?.raw;
    if (
      first in units &&
      second &&
      (hundredWords as readonly string[]).includes(second)
    ) {
      value = units[first] * 100;
      hasMultiplier = true;
      matched = true;
      i += 2;
    } else if (first && (hundredWords as readonly string[]).includes(first)) {
      value = 100;
      hasMultiplier = true;
      matched = true;
      i += 1;
      const next = tokens[i]?.raw;
      if (next && next in tensTeensUnits) {
        value += tensTeensUnits[next];
        i += 1;
      }
    } else if (first && first in tensTeensUnits) {
      value = tensTeensUnits[first];
      matched = true;
      i += 1;
    }
    if (!matched) continue;

    const afterHundred = tokens[i]?.raw;
    if (afterHundred === thousandWord) {
      value *= 1_000;
      hasMultiplier = true;
      i += 1;
    } else if (
      afterHundred &&
      (millionWords as readonly string[]).includes(afterHundred)
    ) {
      value *= 1_000_000;
      hasMultiplier = true;
      i += 1;
    }

    // Un seul mot-tens/teens/units nu, sans "cent"/"mille"/"million" —
    // jamais un prix en soi ("trois" seul n'est pas 3, règle A) : on exige
    // au moins un multiplicateur pour que ce soit un candidat plausible.
    if (!hasMultiplier) continue;

    return { value, end: i, hasMultiplier };
  }
  return null;
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

    // Nombres en lettres ("quatre-vingt-dix millions", "trois cent mille",
    // "one hundred thousand" — lot 7 bis, règle F). Essayé en premier : ces
    // mots ne collisionnent jamais avec les formes chiffrées ci-dessous.
    // Valeur déjà finale (pas de `multiplierFactor` à prêter à un voisin
    // dans une fourchette — limite acceptée, hors des exemples du lot).
    const written = parseWrittenNumber(tokens, i);
    if (written) {
      value = written.value;
      end = written.end;
      hasMultiplier = written.hasMultiplier;
    }

    // "350k" / "1.5m" / "25mil" — suffixe multiplicateur collé au nombre
    // ("mil" = abréviation FR de "mille", lot 7 bis, règle A).
    const suffixMatch =
      value === null ? /^(\d+(?:[.,]\d+)?)(k|m|mil)$/.exec(raw) : null;
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

    // "1,5" (FR) ou "1.5" (EN, lot 7 ter) suivi d'un mot-multiplicateur
    // écrit : million(s) (FR/EN partagent le mot), ou "mille" = x1000 (FR,
    // "100 mille"/"400 mille" — lot 7, règle 2). Jamais "k"/"m" ici
    // (suffixe collé, forme à part ci-dessus) : liste explicite, pas tout
    // `multipliers`. Le point décimal ("1.5") ne collisionne jamais avec
    // le motif milliers ci-dessus (3 chiffres exacts après le point) —
    // bug découvert sur "budget 1.5 million" (EN), jamais reconnu.
    if (value === null && /^\d+(?:[.,]\d+)?$/.test(raw)) {
      const next = tokens[i + 1]?.raw;
      const WORD_MULTIPLIERS = ['million', 'millions', 'mille', 'mil'];
      if (next && WORD_MULTIPLIERS.includes(next)) {
        const base = Number(raw.replace(',', '.'));
        if (Number.isFinite(base)) {
          const mult =
            next === 'mille' || next === 'mil'
              ? 1_000
              : (multipliers.million ?? 1_000_000);
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
export interface PriceContext {
  /** Type de transaction déjà déterminé (location/vente) — "contexte de
   * budget clair" pour la règle G (lot 7 bis), transmis par
   * extractCriteria.ts (déjà calculé par transaction.ts à ce stade). */
  transactionType?: string;
}

export function extractPrice(
  tokens: Token[],
  dictionaries: LanguageDictionary[],
  alreadyConsumed: ReadonlySet<number>,
  context: PriceContext = {},
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

  // Montant "total" pour un séjour court (for N days/nights + total) —
  // jamais un prix mensuel (lot 7 bis, règle A). "total"/"au total" adjacent
  // au montant ET une durée en jours/nuits présente quelque part dans la
  // requête : les deux conditions ensemble, pour ne jamais bloquer un
  // "total" sans rapport (ex. un simple "au total" isolé).
  // "semaine(s)"/"week(s)" ajoutés (lot 7 ter, règle 4) — "mois"/"month"
  // restent volontairement absents (décision de portée confirmée : une
  // durée en mois n'empêche jamais un prix MENSUEL, c'est son unité par
  // défaut).
  const STAY_DURATION_WORDS = [
    'jour',
    'jours',
    'nuit',
    'nuits',
    'day',
    'days',
    'night',
    'nights',
    'semaine',
    'semaines',
    'week',
    'weeks',
    'weekend',
    'weekends',
  ];
  const TOTAL_WORDS = ['total', 'au total', 'in total'];
  const hasStayDurationContext = tokens.some(
    (t, idx) =>
      /^\d{1,2}$/.test(t.raw) &&
      STAY_DURATION_WORDS.includes(tokens[idx + 1]?.raw ?? ''),
  );
  const totalBlocked = new Set<NumberCandidate>();
  if (hasStayDurationContext) {
    for (const c of availableCandidates) {
      if (periodBlocked.has(c)) continue;
      if (adjacentPhrase(tokens, c, TOTAL_WORDS)) totalBlocked.add(c);
    }
  }

  // Un candidat avec multiplicateur/devise est préféré au simple plus
  // proche (lot 7 bis, règle A) : "budget 2000 ou 3 millions" doit choisir
  // "3 millions", pas "2000" (plus proche mais sans indice de prix fort).
  function candidateRank(c: NumberCandidate): number {
    return c.hasMultiplier || c.hasCurrency ? 0 : 1;
  }

  // Une virgule/point entre `fromIndex` et le candidat bloque la recherche
  // (lot 7 ter, règle 1 : "même proposition, sans ponctuation entre eux")
  // — perdue à la tokenisation mais retenue via `brokenAfter` sur chaque
  // token. Bug découvert sur "3ème étage minimum, 350.000 FCFA par mois
  // maximum" : "minimum" (collé à "étage", une quantité non monétaire)
  // traversait la virgule pour happer le montant à tort (minPrice au lieu
  // de maxPrice, le "maximum" directement collé au montant étant ignoré).
  function crossesClauseBreak(fromIndex: number, toIndex: number): boolean {
    for (let k = fromIndex - 1; k < toIndex; k++) {
      if (tokens[k]?.brokenAfter) return true;
    }
    return false;
  }

  function nearestUnclaimed(
    fromIndex: number,
    requireUsableAlone: boolean,
    preferMultiplier = false,
  ): NumberCandidate | undefined {
    let best: NumberCandidate | undefined;
    for (const c of availableCandidates) {
      if (claimed.has(c) || periodBlocked.has(c) || totalBlocked.has(c))
        continue;
      if (c.start < fromIndex) continue;
      if (c.start - fromIndex > 4) continue; // fenêtre de recherche courte
      if (requireUsableAlone && !isUsableAlone(c)) continue;
      if (crossesClauseBreak(fromIndex, c.start)) continue;
      if (
        !best ||
        (preferMultiplier && candidateRank(c) < candidateRank(best)) ||
        ((!preferMultiplier || candidateRank(c) === candidateRank(best)) &&
          c.start < best.start)
      ) {
        best = c;
      }
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
        if (!POSTFIX_ELIGIBLE.has(kw)) continue;
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
          !totalBlocked.has(c) &&
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
            !totalBlocked.has(c) &&
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

    // "70 à 85 millions" / "70 to 85 million" / "70 - 85 million" — même
    // fourchette, sans mot-clé introductif ("entre"/"between"/"from") : un
    // mot central nu (à/to/-) entre deux candidats adjacents suffit (lot 7
    // bis, règle D). Risque de faux positif jugé faible : le mot central
    // doit être immédiatement collé aux deux nombres.
    for (const mid of RANGE_BARE_MID_WORDS) {
      for (let i = 0; i + 1 <= tokens.length; i++) {
        const midLen = matchPhraseAt(tokens, i, mid);
        if (!midLen || isRangeConsumed(i, i + midLen, alreadyConsumed))
          continue;
        const first = availableCandidates.find(
          (c) => !claimed.has(c) && !periodBlocked.has(c) && c.end === i,
        );
        if (!first) continue;
        const second = nearestUnclaimed(i + midLen, false);
        if (!second || second.start !== i + midLen) continue;

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
        markSpan(first.start, first.end);
        markSpan(i, i + midLen);
        markSpan(second.start, second.end);
        matchedSpans.push({
          category: 'price',
          text: `${firstValue} ${mid} ${secondValue}`,
          value: `${lo}-${hi}`,
        });
      }
    }
  }

  // Mots-clés simples (budget/max/min…) — SÉPARÉ de la boucle des
  // fourchettes ci-dessus, et lancé seulement APRÈS elle pour TOUS les
  // dictionnaires (pas seulement celui en cours) : "budget between 70 and
  // 85 million" plantait sinon, "budget" (dict FR, traité avant le dict EN
  // dans `dictionaries`) happait "85 million" via la préférence
  // multiplicateur avant même que la boucle "between...and" (dict EN,
  // traité après) ait sa chance — lot 7 bis, bug découvert sur ce cas réel.
  // Quantités NON monétaires (lot 7 ter, règle 1) — étend
  // `FORBIDDEN_FOLLOW_WORDS` avec étage/floor (ordinal, aucun extracteur
  // dédié) et les mots de durée (nuits/jours/semaines/années — déjà gérés
  // pour le MONTANT lui-même via `periodBlocked`, pas encore pour le
  // QUALIFICATIF qui le précède). Un qualificatif collé à l'une d'elles
  // (juste avant OU juste après, "étage minimum"/"minimum 6 personnes")
  // lui est déjà lié : il ne doit jamais descendre/remonter sur un
  // montant plus loin — bug découvert sur "3ème étage minimum, 350.000
  // FCFA par mois maximum" (minPrice posé au lieu de maxPrice).
  const NON_MONETARY_QUALIFIER_NEIGHBORS = [
    ...FORBIDDEN_FOLLOW_WORDS,
    'etage',
    'etages',
    'floor',
    'floors',
    'nuit',
    'nuits',
    'night',
    'nights',
    'jour',
    'jours',
    'day',
    'days',
    'semaine',
    'semaines',
    'week',
    'weeks',
    'weekend',
    'weekends',
    'an',
    'ans',
    'annee',
    'annees',
    'year',
    'years',
  ];
  function boundToNonMonetaryQuantity(
    kw: string,
    i: number,
    len: number,
  ): boolean {
    // Seuls les mots-clés qui peuvent grammaticalement se lire AVANT OU
    // APRÈS ("minimum"/"maximum"/"min"/"max"/"au moins"/"au plus"...,
    // `POSTFIX_ELIGIBLE`) risquent d'être déjà "collés" à la quantité qui
    // les précède ("étage minimum"). "budget"/"jusqu'à"/"up to"/"under"...
    // ne se lisent jamais en arrière : les bloquer ici était un faux
    // positif, bug découvert sur "2 chambres budget 250000" (maxPrice
    // perdu à tort, "chambres" juste avant "budget").
    if (!POSTFIX_ELIGIBLE.has(kw)) return false;
    // Une virgule/point entre la quantité et le mot-clé ("chambres,
    // jusqu'à") annule le collage : ce n'est plus "collé", c'est une
    // clause séparée — bug découvert sur "au moins 3 chambres, jusqu'à
    // 400k" (maxPrice perdu à tort).
    if (
      !tokens[i - 1]?.brokenAfter &&
      NON_MONETARY_QUALIFIER_NEIGHBORS.includes(tokens[i - 1]?.raw ?? '')
    ) {
      return true;
    }
    const after = tokens[i + len]?.raw ?? '';
    if (NON_MONETARY_QUALIFIER_NEIGHBORS.includes(after)) return true;
    if (
      /^\d{1,3}$/.test(after) &&
      NON_MONETARY_QUALIFIER_NEIGHBORS.includes(tokens[i + len + 1]?.raw ?? '')
    ) {
      return true;
    }
    return false;
  }

  // `maxKeywordPositions`/`minKeywordPositions` : certains mots-clés (ex.
  // "budget") existent dans les deux dictionnaires (FR et EN) ; sans ce
  // suivi, la même occurrence à l'index `i` matchait deux fois (une par
  // dictionnaire), la 2e fois retombant sur un candidat non pertinent déjà
  // libre et écrasant le prix correct — lot 7 bis, bug découvert sur
  // "budget 2000 ou 3 millions pour une villa" (maxPrice=2000 au lieu de
  // 3000000).
  const maxKeywordPositions = new Set<number>();
  const minKeywordPositions = new Set<number>();
  for (const dict of dictionaries) {
    for (const kw of dict.price.maxKeywords) {
      for (let i = 0; i + 1 <= tokens.length; i++) {
        if (maxKeywordPositions.has(i)) continue;
        const len = matchPhraseAt(tokens, i, kw);
        if (!len || isRangeConsumed(i, i + len, alreadyConsumed)) continue;
        if (boundToNonMonetaryQuantity(kw, i, len)) continue;
        const cand = nearestUnclaimed(i + len, true, true);
        if (!cand) continue;
        maxKeywordPositions.add(i);
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
        if (minKeywordPositions.has(i)) continue;
        const len = matchPhraseAt(tokens, i, kw);
        if (!len || isRangeConsumed(i, i + len, alreadyConsumed)) continue;
        if (boundToNonMonetaryQuantity(kw, i, len)) continue;
        const cand = nearestUnclaimed(i + len, true, true);
        if (!cand) continue;
        minKeywordPositions.add(i);
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
      if (
        claimed.has(cand) ||
        periodBlocked.has(cand) ||
        totalBlocked.has(cand)
      )
        continue;
      // `isUsableAlone` manquait ici (jamais vérifié pour le candidat
      // postfixe) — un petit nombre nu sans rapport ("2" avant "etages")
      // pouvait devenir la cible d'un "min"/"max" plus loin — lot 7 ter,
      // bug découvert sur "villa 2 etages min, 2000000" (minPrice:2).
      if (!isUsableAlone(cand)) continue;
      // Une virgule/point juste après le montant bloque toute recherche
      // postfixe : "3 bedrooms, max 500000" ne doit pas laisser "max"
      // (direction d'une tout autre clause) qualifier un montant qu'il ne
      // suit pas vraiment — lot 7 bis, bug découvert sur ce cas réel.
      if (tokens[cand.end - 1]?.brokenAfter) continue;
      let matchedMax: { i: number; len: number; kw: string } | undefined;
      let matchedMin: { i: number; len: number; kw: string } | undefined;
      for (let i = cand.end; i <= Math.min(cand.end + 4, tokens.length); i++) {
        if (i > cand.end && tokens[i - 1]?.brokenAfter) break;
        if (!matchedMax) {
          for (const kw of dict.price.maxKeywords) {
            if (!POSTFIX_ELIGIBLE.has(kw)) continue;
            const len = matchPhraseAt(tokens, i, kw);
            if (len && !isRangeConsumed(i, i + len, alreadyConsumed)) {
              matchedMax = { i, len, kw };
              break;
            }
          }
        }
        if (!matchedMax && !matchedMin) {
          for (const kw of dict.price.minKeywords) {
            if (!POSTFIX_ELIGIBLE.has(kw)) continue;
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
  // Montant "total" pour un séjour court — jamais un prix (lot 7 bis, règle A).
  for (const c of totalBlocked) {
    if (isUsableAlone(c)) ambiguities.push('stayTotal');
  }
  // Montant plausible, jamais réclamé par une fourchette/approximatif/
  // direction : compris, mais la direction (min ou max ?) reste inconnue —
  // SAUF contexte de budget clair (lot 7 bis, règle G, décision produit) :
  // location/vente déjà posée, ou période mensuelle adjacente -> maxPrice
  // avec la même marge de +10 % que l'approximatif, ambiguïté targetAmount
  // dédiée (jamais confondue avec un "environ" explicite).
  // `maxPrice` déjà posé avant cette boucle (budget/fourchette/etc.) est un
  // montant CONFIRMÉ — un candidat restant ici (jamais réclamé, "parasite"
  // possible comme un fragment de téléphone non reconnu) ne doit jamais
  // l'abaisser via `Math.min` (lot 7 ter, règle 2 : "ne perds jamais le
  // montant explicite à cause d'un nombre parasite"). Les candidats
  // `targetAmount` restent regroupés entre eux (min conservateur) et ne
  // s'appliquent à `maxPrice` que s'il est encore libre.
  const maxPriceAlreadyConfirmed = maxPrice !== undefined;
  let targetAmountCandidate: number | undefined;
  for (const c of availableCandidates) {
    if (claimed.has(c) || periodBlocked.has(c) || totalBlocked.has(c)) continue;
    if (!isUsableAlone(c)) continue;
    const clearBudgetContext =
      adjacentPhrase(tokens, c, monthlyPeriodKeywords) ||
      context?.transactionType !== undefined;
    if (clearBudgetContext) {
      const raised = c.value * 1.1;
      const rounded =
        raised >= 1000 ? Math.round(raised / 1000) * 1000 : Math.round(raised);
      targetAmountCandidate =
        targetAmountCandidate === undefined
          ? rounded
          : Math.min(targetAmountCandidate, rounded);
      ambiguities.push('targetAmount');
      markSpan(c.start, c.end);
      matchedSpans.push({
        category: 'price',
        text: String(c.value),
        value: `~${rounded}`,
      });
    } else {
      ambiguities.push('amountDirection');
    }
  }
  if (targetAmountCandidate !== undefined && !maxPriceAlreadyConfirmed) {
    maxPrice = targetAmountCandidate;
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
