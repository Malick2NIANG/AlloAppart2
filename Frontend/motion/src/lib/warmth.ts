import { interpolate } from 'remotion';
import { EASE, CLAMP } from './anim';
import { T } from '../config/timeline';

/**
 * "Chaleur" globale de la scène : 0 = acte 1 froid (aucun doré),
 * 1 = univers AlloAppart. Revient à 0 à la fin → raccord de boucle.
 */
export const warmth = (frame: number) => {
  if (frame < T.loopOut.start) {
    return interpolate(frame, [114, 152], [0, 1], { ...CLAMP, easing: EASE.inOut });
  }
  return interpolate(frame, [T.loopOut.start, T.loopOut.end - 2], [1, 0], {
    ...CLAMP,
    easing: EASE.inOut,
  });
};
