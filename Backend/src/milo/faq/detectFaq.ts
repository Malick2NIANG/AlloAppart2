import { normalizeText } from '../normalize';
import { tokenize } from '../tokenize';
import { matchPhraseAt } from '../tokenize';
import { FAQ_TOPICS, GENERIC_QUESTION_MARKERS } from './faqTopics';
import type { MiloStrictFilters } from '../types';

export interface MiloFaqResult {
  id: string;
  answerKey: string;
  confidence: number;
}

function countMatches(
  tokens: ReturnType<typeof tokenize>,
  keywords: readonly string[],
): number {
  let score = 0;
  for (const kw of keywords) {
    const words = kw.split(' ');
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (matchPhraseAt(tokens, i, kw) === words.length) score++;
    }
  }
  return score;
}

/**
 * Détection d'intention FAQ (lot « Milo FAQ ») — mots-clés/synonymes FR+EN
 * + score, exactement comme le reste du parseur (extractAmenities,
 * extractSoftPreferences) : AUCUN appel à un modèle externe.
 *
 * Règle absolue : un critère de recherche déjà posé (strictFilters non
 * vide) fait toujours gagner la recherche, jamais une devinette FAQ — ni
 * même un essai de score (court-circuit immédiat, avant tout calcul).
 *
 * Si aucun sujet précis ne score mais qu'un marqueur générique de question
 * est présent (y compris un "?" littéral dans le texte original, retiré par
 * normalizeText donc vérifié ici séparément) → sujet `unknown` (réponse
 * honnête, jamais une devinette). Ni critère de recherche ni marqueur de
 * question → `undefined` (comportement actuel inchangé, aucun champ `faq`).
 */
export function detectFaqIntent(
  rawText: string,
  strictFilters: MiloStrictFilters,
): MiloFaqResult | undefined {
  if (Object.keys(strictFilters).length > 0) return undefined;

  const normalized = normalizeText(rawText ?? '');
  const tokens = tokenize(normalized);
  // "?" seul (ou avec des mots vides) : normalizeText le retire entièrement
  // (ponctuation), les tokens peuvent donc être vides alors que le texte
  // brut contenait bien un "?" — vérifié indépendamment des tokens pour ne
  // jamais le perdre.
  if (tokens.length === 0 && !(rawText ?? '').includes('?')) return undefined;

  let best: { topic: (typeof FAQ_TOPICS)[number]; score: number } | undefined;
  for (const topic of FAQ_TOPICS) {
    const score =
      countMatches(tokens, topic.keywords.fr) +
      countMatches(tokens, topic.keywords.en);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }

  if (best) {
    return {
      id: best.topic.id,
      answerKey: best.topic.answerKey,
      confidence: Math.min(1, 0.5 + best.score * 0.25),
    };
  }

  const hasGenericQuestionMarker =
    countMatches(tokens, GENERIC_QUESTION_MARKERS.fr) > 0 ||
    countMatches(tokens, GENERIC_QUESTION_MARKERS.en) > 0 ||
    (rawText ?? '').includes('?');

  if (hasGenericQuestionMarker) {
    return { id: 'unknown', answerKey: 'unknown', confidence: 0.3 };
  }

  return undefined;
}
