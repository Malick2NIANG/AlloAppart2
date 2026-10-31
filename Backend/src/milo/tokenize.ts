/**
 * Découpage en mots du texte normalisé, avec leurs positions — permet à
 * chaque extracteur de "consommer" les indices de mots qu'il a reconnus
 * (pour les phrases multi-mots, un intervalle d'indices). Les mots
 * restants, non vides, servent à construire `unmatchedTokens`.
 */
export interface Token {
  raw: string;
  index: number;
}

/**
 * Ponctuation attenante (. , en début/fin de mot) à retirer — JAMAIS à
 * l'intérieur d'un nombre ("150.000", "1,5", "30,000"), où elle fait partie
 * de sa valeur. Un `.`/`,` en bout de mot ("Dakar." "mois," "svp.") est
 * toujours de la ponctuation de phrase, jamais une partie du nombre : les
 * séparateurs internes aux nombres ne sont, par construction, ni en
 * première ni en dernière position du token (lot 7, règle 2 — ";:!?()«»"'"
 * sont déjà retirés par normalizeText, qui ne les laisse pas passer).
 * Appliqué une seule fois ici, en amont de tous les extracteurs (types,
 * lieux, équipements compris).
 */
function stripAttachedPunctuation(raw: string): string {
  return raw.replace(/^[.,]+/, '').replace(/[.,]+$/, '');
}

export function tokenize(normalizedText: string): Token[] {
  if (!normalizedText) return [];
  return normalizedText
    .split(' ')
    .map(stripAttachedPunctuation)
    .filter((t) => t.length > 0)
    .map((raw, index) => ({ raw, index }));
}

/** Essaie de faire correspondre une phrase multi-mots (ex. "a vendre",
 * "proche de la mer") à partir de l'indice `from` des tokens. Retourne le
 * nombre de tokens consommés (0 si pas de correspondance). Correspondance
 * exacte mot à mot (pas de tolérance aux fautes sur les phrases, la
 * tolérance se limite aux mots-clés simples — règle du lot 1b). */
export function matchPhraseAt(
  tokens: Token[],
  from: number,
  phrase: string,
): number {
  const phraseWords = phrase.split(' ').filter(Boolean);
  if (from + phraseWords.length > tokens.length) return 0;
  for (let i = 0; i < phraseWords.length; i++) {
    if (tokens[from + i].raw !== phraseWords[i]) return 0;
  }
  return phraseWords.length;
}
