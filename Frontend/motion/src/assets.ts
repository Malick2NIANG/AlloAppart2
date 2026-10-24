/**
 * Assets de marque — importés DIRECTEMENT depuis Frontend/public,
 * sans copie ni modification (aucun asset existant n'est remplacé).
 *   LOGO.png    : lockup officiel 500×500 RGBA, fond transparent.
 *                 Contenu utile : x 43→461, y 173→326 (maison : x 43→210).
 *   favicon.svg : maison vectorielle (#facc15 → #b58900), pour les zooms.
 */
import logoPng from '../../public/images/LOGO.png';
import logoSvg from '../../public/favicon.svg';

export const LOGO_PNG = logoPng;
export const LOGO_SVG = logoSvg;

/** Géométrie mesurée du PNG (px, repère 500×500). */
export const LOGO_PNG_GEOMETRY = {
  size: 500,
  content: { x0: 43, y0: 173, x1: 461, y1: 326 },
  house: { x0: 43, y0: 173, x1: 210, y1: 326 },
  /** Début du texte "LLO / PPART" — sert de ligne de coupe du masque. */
  textStartX: 232,
} as const;

/** Géométrie de favicon.svg (viewBox 64×64) : maison x 4→60, y 8→56. */
export const LOGO_SVG_GEOMETRY = {
  viewBox: 64,
  house: { x0: 4, y0: 8, x1: 60, y1: 56 },
} as const;
