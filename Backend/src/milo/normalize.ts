/**
 * Normalisation — minuscules, accents retirés, apostrophes/espaces
 * uniformisés. Les chiffres et séparateurs (`.` `,`) sont conservés tels
 * quels : la normalisation des NOMBRES (séparateurs de milliers, k/m,
 * million(s)) est une étape séparée, propre à l'extracteur de montants
 * (price.ts) — un "350.000" et un "1.5" n'ont pas la même signification
 * du point `.`, le contexte (suffixe k/m, mot-clé de prix) tranche.
 */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeText(s: string): string {
  return stripAccents(s.toLowerCase())
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9%²'.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distance d'édition de Levenshtein — utilisée uniquement pour la
 * tolérance aux fautes sur les mots-clés (jamais sur les nombres). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Un mot du texte correspond-il à un mot-clé du dictionnaire ?
 * Égalité stricte en dessous de 6 caractères (pas de faute tolérée sur les
 * mots courts, règle explicite du lot 1b) ; distance d'édition ≤ 1 à
 * partir de 6 caractères.
 */
export function isWordMatch(word: string, keyword: string): boolean {
  if (word === keyword) return true;
  if (keyword.length < 6) return false;
  if (Math.abs(word.length - keyword.length) > 1) return false;
  return levenshtein(word, keyword) <= 1;
}
