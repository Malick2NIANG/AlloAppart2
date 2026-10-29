/**
 * Milo Search v0 — lot 3 (Frontend/rapports-milo/PLAN_SEARCH_V0.md § 2.b ;
 * Milo.md § 3.4). Fonction pure, coût zéro, exécution CPU : aucune API
 * externe, aucune dépendance à réseau. N'est branchée nulle part (l'endpoint
 * est le lot 4) — exportée et testée seulement.
 *
 * Signal principal : les `signals` fr/en d'extractCriteria (lot 1, poids
 * fort — un vrai mot-clé de dictionnaire reconnu) + une petite liste de
 * mots-outils FR/EN à poids faible (« je cherche », « i'm looking for »…),
 * qui ne comptent pas comme signaux dans extractCriteria (ce sont des mots
 * vides pour l'extraction de critères) mais restent un indice de langue.
 * Une langue gagne si son score est STRICTEMENT supérieur à l'autre.
 *
 * Égalité (y compris 0-0) : repli sur la bibliothèque (tinyld) seulement si
 * la requête fait au moins 4 mots — en dessous, tinyld n'est pas fiable
 * (vérifié empiriquement, cf. rapport du lot 3 : une requête de 2-3 mots,
 * même sans ambiguïté pour un humain, est souvent mal classée). Sous ce
 * seuil, `language = defaultLocale` (le sélecteur FR/EN du header),
 * `method: 'default'`, confiance basse. Un nom de lieu seul (« villa
 * Almadies ») suit automatiquement cette règle : 2 mots, jamais de
 * bibliothèque.
 */
import { extractCriteria } from '../extractCriteria';
import { normalizeText } from '../normalize';
import { detectAll as tinyldDetectAll } from 'tinyld';

export type DetectedLanguage = 'fr' | 'en' | 'unsupported';
export type DetectionMethod = 'dictionary' | 'library' | 'default';

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  /** 0-1. Jamais 1 (aucune méthode heuristique ici n'est absolument certaine). */
  confidence: number;
  method: DetectionMethod;
}

/** Mots-outils à poids faible — ne sont PAS des mots-clés d'extraction de
 * critères (extractCriteria les ignore, certains sont même des stopWords),
 * mais restent un indice de langue utile sur des requêtes courtes/polies. */
const FUNCTION_WORDS_FR = [
  'je cherche',
  'je recherche',
  'je veux',
  'je voudrais',
  'svp',
  'bonjour',
  'pour',
  'avec',
  'dans',
];
const FUNCTION_WORDS_EN = [
  "i'm looking for",
  'looking for',
  'i want',
  "i'd like",
  'please',
  'hello',
  'with',
  'near',
  // NB : "in" délibérément exclu — préposition partagée avec l'italien
  // ("in affitto", "in centro") et d'autres langues latines, qui produisait
  // un faux positif EN sur du texte italien (vérifié empiriquement, § lot 3
  // du rapport : "Cerco un appartamento in affitto in centro" classé EN
  // avant ce correctif).
];

const LOW_WEIGHT = 0.5;
const MIN_WORDS_FOR_LIBRARY = 4;
/** En dessous de ce score relatif (marge top/2e), la bibliothèque n'est pas
 * jugée assez sûre pour trancher « unsupported » — repli sur defaultLocale
 * plutôt qu'une détection de langue tierce peu fiable (décision du lot 3). */
const LIBRARY_CONFIDENT_ENOUGH = 0.55;

function countFunctionWordSignals(normalized: string, words: string[]): number {
  let count = 0;
  for (const w of words) if (normalized.includes(w)) count++;
  return count;
}

/** Confiance croissante avec la marge ET jamais à 1 (heuristique, pas une
 * certitude). Un seul mot-outil à poids faible en avance ne donne qu'une
 * confiance tout juste au-dessus de 0,5 ; un vrai mot-clé de dictionnaire
 * en avance donne une confiance nettement plus haute. */
function marginConfidence(winner: number, loser: number): number {
  const margin = winner - loser;
  return Math.round(Math.min(0.95, 0.5 + margin * 0.15) * 100) / 100;
}

function detectViaLibrary(
  text: string,
  defaultLocale: 'fr' | 'en',
): LanguageDetectionResult {
  const ranked = tinyldDetectAll(text);
  if (ranked.length === 0) {
    return { language: defaultLocale, confidence: 0.3, method: 'default' };
  }
  const top = ranked[0];
  const second = ranked[1] ?? { lang: '', accuracy: 0 };
  const margin = top.accuracy - second.accuracy;
  const confidence = Math.round(Math.min(0.95, 0.5 + margin * 3) * 100) / 100;

  // Le seuil de confiance s'applique à TOUTE sortie de la bibliothèque, pas
  // seulement à « unsupported » — un résultat fr/en peu sûr est tout aussi
  // risqué qu'un « unsupported » hasardeux (vérifié empiriquement, § lot 3
  // du rapport : sans ce garde-fou, une phrase à peine latine pouvait être
  // rendue « en » avec une confiance à peine au-dessus de 0,5).
  if (confidence < LIBRARY_CONFIDENT_ENOUGH) {
    return { language: defaultLocale, confidence: 0.3, method: 'default' };
  }

  if (top.lang === 'fr')
    return { language: 'fr', confidence, method: 'library' };
  if (top.lang === 'en')
    return { language: 'en', confidence, method: 'library' };
  return { language: 'unsupported', confidence, method: 'library' };
}

export function detectLanguage(
  text: string,
  defaultLocale: 'fr' | 'en',
): LanguageDetectionResult {
  const raw = text ?? '';
  const wordCount = raw.trim().split(/\s+/).filter(Boolean).length;
  const normalized = normalizeText(raw);

  const extraction = extractCriteria(raw);
  const frScore =
    extraction.signals.fr +
    countFunctionWordSignals(normalized, FUNCTION_WORDS_FR) * LOW_WEIGHT;
  const enScore =
    extraction.signals.en +
    countFunctionWordSignals(normalized, FUNCTION_WORDS_EN) * LOW_WEIGHT;

  if (frScore > enScore) {
    return {
      language: 'fr',
      confidence: marginConfidence(frScore, enScore),
      method: 'dictionary',
    };
  }
  if (enScore > frScore) {
    return {
      language: 'en',
      confidence: marginConfidence(enScore, frScore),
      method: 'dictionary',
    };
  }

  // Égalité (y compris 0-0).
  if (wordCount < MIN_WORDS_FOR_LIBRARY) {
    return { language: defaultLocale, confidence: 0.3, method: 'default' };
  }
  return detectViaLibrary(raw, defaultLocale);
}
