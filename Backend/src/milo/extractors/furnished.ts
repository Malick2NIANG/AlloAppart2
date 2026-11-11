import type { Token } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import type { MiloMatchedSpan } from '../types';

/**
 * Meublé/non meublé (lot meublé/durée) — « meublé » n'est volontairement
 * pas dans la liste des équipements (Frontend/src/lib/listingProfile.ts,
 * décision du lot 7) : extracteur dédié, même principe de négation que
 * extractors/amenities.ts (fenêtre de 3 mots) mais la négation ici PRODUIT
 * directement `furnished: false` (ce n'est pas un équipement à exclure,
 * c'est l'attribut lui-même qui est nié).
 */
export interface FurnishedExtraction {
  furnished?: boolean;
  consumed: Set<number>;
  matchedSpans: MiloMatchedSpan[];
}

// "meublé"/"meublée"/"meublés"/"meublées" perdent tous leur accent à la
// normalisation et deviennent "meuble"/"meublee"/"meubles"/"meublees" —
// "meubles" (pluriel de l'adjectif) coïncide avec "meubles" (le nom,
// "sans meubles"/"avec meubles") : même token, même traitement dans les
// deux cas, aucune distinction nécessaire.
const FURNISHED_WORDS_FR = ['meuble', 'meublee', 'meubles', 'meublees'];
const FURNISHED_WORDS_EN = ['furnished'];
// "vide" (FR, argot immobilier sénégalais : "studio vide" = non meublé),
// "unfurnished" (EN, forme glued déjà négative) et "non-meublé(e)(s)" (le
// tiret n'est JAMAIS retiré par normalize.ts — lot 7 règle 3 — donc
// "non-meuble" reste un seul token, ne matche jamais "meuble" nu ni "non"
// seul : déclencheur direct dédié) — toujours furnished=false, jamais une
// histoire de négation adjacente.
const DIRECT_FALSE_WORDS = [
  'vide',
  'unfurnished',
  'non-meuble',
  'non-meublee',
  'non-meubles',
  'non-meublees',
];

// Fenêtre de négation un peu plus large que amenities.ts : inclut "pas"
// NU (sans "de"), explicitement demandé ("pas meublé", pas "pas de
// meublé" qui ne se dit pas) — propre à cet extracteur, n'affecte pas
// NEGATION_PHRASES d'amenities.ts.
const NEGATION_PHRASES = [
  'surtout pas de',
  'no need for',
  "don't want",
  'pas de',
  "pas d'",
  'pas',
  'sans',
  'non',
  'aucun',
  'aucune',
  'without',
  'no',
  'not',
];

function hasAdjacentNegation(tokens: Token[], start: number): boolean {
  const WINDOW = 3;
  for (const phrase of NEGATION_PHRASES) {
    const words = phrase.split(' ');
    for (
      let from = start - words.length;
      from >= Math.max(0, start - WINDOW);
      from--
    ) {
      if (matchPhraseAt(tokens, from, phrase) === words.length) return true;
    }
  }
  return false;
}

export function extractFurnished(tokens: Token[]): FurnishedExtraction {
  const consumed = new Set<number>();
  const matchedSpans: MiloMatchedSpan[] = [];
  let furnished: boolean | undefined;

  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue;
    const raw = tokens[i].raw;

    if (DIRECT_FALSE_WORDS.includes(raw)) {
      furnished = false;
      consumed.add(i);
      matchedSpans.push({
        category: 'amenity',
        text: raw,
        value: 'furnished=false',
      });
      continue;
    }

    if (FURNISHED_WORDS_FR.includes(raw) || FURNISHED_WORDS_EN.includes(raw)) {
      const negated = hasAdjacentNegation(tokens, i);
      furnished = !negated;
      consumed.add(i);
      matchedSpans.push({
        category: 'amenity',
        text: raw,
        value: negated ? 'furnished=false' : 'furnished=true',
      });
    }
  }

  return { furnished, consumed, matchedSpans };
}
