/**
 * Milo Search v0 — lot 6a (PLAN_SEARCH_V0.md) : dictionnaire de CLASSEMENT
 * par préférence floue — distinct de `dictionaries/fr.ts`/`en.ts`
 * `softPreferences` (qui servent à RECONNAÎTRE la préférence dans la
 * requête de l'utilisateur, liste volontairement courte). Ici, il s'agit au
 * contraire de repérer les mots-clés dans le TITRE/LA DESCRIPTION d'une
 * annonce réelle pour la classer — vocabulaire volontairement plus large
 * (FR + EN mélangés, une annonce peut être rédigée dans l'une ou l'autre).
 *
 * Une préférence floue CLASSE, elle n'exclut JAMAIS une annonce.
 */
import { normalizeText } from './normalize';

export type SoftPreferenceId = 'near_sea' | 'quiet' | 'upscale';

export const PREFERENCE_KEYWORDS: Record<SoftPreferenceId, readonly string[]> =
  {
    near_sea: [
      'mer',
      'bord de mer',
      'front de mer',
      'plage',
      'ocean',
      'corniche',
      'vue mer',
      'sea',
      'seafront',
      'beach',
      'sea view',
    ],
    quiet: ['calme', 'tranquille', 'paisible', 'quiet', 'peaceful'],
    upscale: [
      'standing',
      'haut standing',
      'luxe',
      'luxueux',
      'prestige',
      'upscale',
      'luxury',
      'premium',
    ],
  };

export const SOFT_PREFERENCE_IDS = Object.keys(
  PREFERENCE_KEYWORDS,
) as SoftPreferenceId[];

export function isSoftPreferenceId(value: string): value is SoftPreferenceId {
  return (SOFT_PREFERENCE_IDS as string[]).includes(value);
}

/**
 * Filtre une liste de valeurs brutes (déjà CSV→tableau côté DTO, comme
 * `amenities`) vers les seuls identifiants reconnus — valeurs inconnues
 * silencieusement ignorées, jamais une erreur 400.
 */
export function parsePreferenceIds(
  values: string[] | undefined,
): SoftPreferenceId[] {
  if (!values) return [];
  return values.map((v) => v.trim()).filter(isSoftPreferenceId);
}

const TITLE_WEIGHT = 2;
const DESCRIPTION_WEIGHT = 1;

/**
 * Score de préférence d'une annonce — nombre d'identifiants demandés dont
 * au moins un mot-clé apparaît dans le titre (pondéré plus fort) ou la
 * description, normalisé (accents/casse ignorés, comme `cityContains`).
 * 0 si `prefIds` est vide ou si aucun mot-clé n'est trouvé — jamais négatif.
 */
export function scoreListingPreferences(
  title: string | null | undefined,
  description: string | null | undefined,
  prefIds: readonly SoftPreferenceId[],
): number {
  if (prefIds.length === 0) return 0;
  const normalizedTitle = normalizeText(title ?? '');
  const normalizedDescription = normalizeText(description ?? '');

  let score = 0;
  for (const id of prefIds) {
    const keywords = PREFERENCE_KEYWORDS[id];
    const inTitle = keywords.some((k) =>
      normalizedTitle.includes(normalizeText(k)),
    );
    const inDescription = keywords.some((k) =>
      normalizedDescription.includes(normalizeText(k)),
    );
    if (inTitle) score += TITLE_WEIGHT;
    else if (inDescription) score += DESCRIPTION_WEIGHT;
  }
  return score;
}
