import { RentalMode } from '@prisma/client';
import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import type { MiloAmbiguity, MiloMatchedSpan } from '../types';

/**
 * Durée de séjour → mode de location (lot meublé/durée). Un indice de durée
 * nuitée (la nuit, N nuits/nights, jours/days, semaine(s)/week(s), weekend,
 * séjour/vacances) pose `rentalMode: NIGHTLY` ; un indice mensuel/long terme
 * (au mois, mensuel, à l'année, longue durée, bail) pose `MONTHLY`. Les deux
 * à la fois dans la même requête : contradictoire, `rentalModeConflict`,
 * aucun des deux posé — jamais de devinette.
 *
 * Ne consomme QUE les mots ayant effectivement contribué à la décision
 * retenue (ou aux deux, en cas de conflit) — les autres extracteurs (price.ts
 * notamment) lisent ces mêmes mots indépendamment via leurs propres
 * dictionnaires, sans jamais dépendre de `consumed` pour ça.
 */
export interface RentalModeHintExtraction {
  rentalMode?: RentalMode;
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
  ambiguities: MiloAmbiguity[];
}

const NIGHTLY_HINT_WORDS = {
  fr: [
    'la nuit',
    'par nuit',
    'nuitee',
    'nuitees',
    'nuit',
    'nuits',
    'jour',
    'jours',
    'semaine',
    'semaines',
    'weekend',
    'sejour',
    'vacances',
    'court sejour',
  ],
  en: [
    'per night',
    'night',
    'nights',
    'day',
    'days',
    'week',
    'weeks',
    'weekend',
    'stay',
    'vacation',
    'short stay',
  ],
};

const MONTHLY_HINT_WORDS = {
  // "mois"/"month" nus ajoutés (très fréquent, "pour 1 mois"/"for 1
  // month") — le reste suit exactement la liste de la tâche.
  fr: [
    'au mois',
    'par mois',
    'mensuel',
    'mensuelle',
    'mois',
    "a l'annee",
    'par an',
    'longue duree',
    'bail',
  ],
  en: [
    'per month',
    'monthly',
    'month',
    'months',
    'for one year',
    'long term',
    'long-term',
    'lease',
  ],
};

function findHints(
  tokens: Token[],
  words: readonly string[],
): { start: number; end: number }[] {
  const hits: { start: number; end: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const phrase of words) {
      const len = matchPhraseAt(tokens, i, phrase);
      if (len) hits.push({ start: i, end: i + len });
    }
  }
  return hits;
}

export function extractRentalModeHint(
  tokens: Token[],
): RentalModeHintExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  const ambiguities: MiloAmbiguity[] = [];

  const nightlyHits = [
    ...findHints(tokens, NIGHTLY_HINT_WORDS.fr),
    ...findHints(tokens, NIGHTLY_HINT_WORDS.en),
  ];
  const monthlyHits = [
    ...findHints(tokens, MONTHLY_HINT_WORDS.fr),
    ...findHints(tokens, MONTHLY_HINT_WORDS.en),
  ];

  const mark = (hits: { start: number; end: number }[], rentalMode: string) => {
    for (const { start, end } of hits) {
      for (let k = start; k < end; k++) consumed.add(k);
      // category 'rooms' choisie par élimination : 'transaction' est lu par
      // deriveAmbiguities (extractCriteria.ts) pour détecter un conflit de
      // TransactionType via la distinction des valeurs — y ajouter une
      // valeur "rentalModeHint=..." fausserait ce calcul à tort.
      matchedSpans.push({
        category: 'rooms',
        text: tokens
          .slice(start, end)
          .map((t) => t.raw)
          .join(' '),
        value: `rentalModeHint=${rentalMode}`,
      });
    }
  };

  if (nightlyHits.length > 0 && monthlyHits.length > 0) {
    mark(nightlyHits, 'NIGHTLY');
    mark(monthlyHits, 'MONTHLY');
    ambiguities.push('rentalModeConflict');
    return { consumed, matchedSpans, ambiguities };
  }
  if (nightlyHits.length > 0) {
    mark(nightlyHits, 'NIGHTLY');
    return {
      rentalMode: RentalMode.NIGHTLY,
      consumed,
      matchedSpans,
      ambiguities,
    };
  }
  if (monthlyHits.length > 0) {
    mark(monthlyHits, 'MONTHLY');
    return {
      rentalMode: RentalMode.MONTHLY,
      consumed,
      matchedSpans,
      ambiguities,
    };
  }
  return { consumed, matchedSpans, ambiguities };
}
