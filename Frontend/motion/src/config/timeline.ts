/**
 * Timeline maîtresse — 20 s × 30 fps = 600 frames.
 *
 *   0s  = frame 0    Acte 1 — le problème
 *   4s  = frame 120  Transition de révélation → Acte 2 — AlloAppart
 *   9s  = frame 270  Acte 3 — fonctionnalités
 *   15s = frame 450  Acte 4 — call to action
 *   20s = frame 600  fin / raccord de boucle vers la frame 0
 *
 * Toutes les scènes sont pilotées en frames ABSOLUES à partir de ces
 * constantes : décaler un acte = changer une valeur ici.
 */
export const FPS = 30;
export const DURATION = 600;

export const T = {
  act1: { start: 0, end: 120 },
  reveal: { start: 100, peak: 121, end: 160 },
  act2: { start: 120, end: 270 },
  act3: { start: 270, end: 450 },
  act4: { start: 450, end: 600 },
  loopOut: { start: 564, end: 600 },
} as const;

/**
 * Points de synchronisation audio (frames). Utilisés par la bande-son
 * générée (scripts/generate-soundtrack.py) et réutilisables par un
 * sound designer pour caler une musique définitive.
 */
export const AUDIO_CUES = {
  tensionStart: 0,
  problemHits: [40, 52, 64],
  riserStart: 96,
  revealImpact: 121,
  logoShimmer: 150,
  logoLock: 180,
  badge: 210,
  act3Whoosh: 268,
  cards: [284, 294, 304, 314],
  act4Whoosh: 452,
  slogan: 472,
  cta: 496,
  loopFade: 564,
} as const;

export const sec = (s: number) => Math.round(s * FPS);
