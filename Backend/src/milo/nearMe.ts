import { normalizeText } from './normalize';
import { tokenize, matchPhraseAt } from './tokenize';
import type { MiloStrictFilters } from './types';

/**
 * Lot « raccourci » (partage + près de moi) — détection de l'intention
 * « près de moi », mots-clés/synonymes FR+EN, même mécanisme que le reste
 * du parseur (extractAmenities, detectFaqIntent) : AUCUN cityContains/
 * region posé par Milo lui-même pour ces mots, seulement un indicateur
 * `nearMe` — c'est le Frontend qui déclenche la demande de position au
 * clic de validation (règle 5, Milo.md : jamais de permission sans geste).
 *
 * Marqueurs volontairement complets (avec "moi"/"me"/seul) pour ne jamais
 * collisionner avec un lieu nommé : "près de la mer" n'en contient aucun.
 * "studio près de Mermoz" : le quartier déjà extrait (cityContains) fait
 * toujours gagner le lieu nommé, jamais nearMe, même si un marqueur
 * apparaissait par ailleurs dans la phrase.
 */
const NEAR_ME_MARKERS: { fr: readonly string[]; en: readonly string[] } = {
  fr: ['pres de moi', 'autour de moi', 'a proximite', 'proche de moi'],
  en: ['near me', 'around me', 'close to me', 'nearby'],
};

function hasMarker(
  tokens: ReturnType<typeof tokenize>,
  keywords: readonly string[],
): boolean {
  for (const kw of keywords) {
    const words = kw.split(' ');
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (matchPhraseAt(tokens, i, kw) === words.length) return true;
    }
  }
  return false;
}

export function detectNearMe(
  rawText: string,
  strictFilters: MiloStrictFilters,
): boolean {
  // Un lieu nommé déjà identifié ailleurs dans la phrase gagne toujours.
  if (strictFilters.cityContains || strictFilters.region) return false;

  const tokens = tokenize(normalizeText(rawText ?? ''));
  if (tokens.length === 0) return false;

  return (
    hasMarker(tokens, NEAR_ME_MARKERS.fr) ||
    hasMarker(tokens, NEAR_ME_MARKERS.en)
  );
}
