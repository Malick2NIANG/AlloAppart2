import { Easing, interpolate, random, spring } from 'remotion';
import { FPS } from '../config/timeline';

export const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Courbes d'easing de la marque — un seul jeu, partout. */
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-out doux, entrées
  inOut: Easing.bezier(0.65, 0, 0.35, 1), // travellings
  in: Easing.bezier(0.55, 0, 1, 0.45), // sorties
  soft: Easing.bezier(0.33, 1, 0.68, 1), // cubic-out
} as const;

/** Interpolation clampée + easing. */
export const tween = (
  frame: number,
  range: [number, number],
  out: [number, number],
  easing: (t: number) => number = EASE.out,
) => interpolate(frame, range, out, { ...CLAMP, easing });

/** Springs : équivalents frame-exacts des springs Framer Motion. */
export const SPRINGS = {
  /** Aucune oscillation — entrées élégantes. */
  smooth: { damping: 200, mass: 1, stiffness: 100 },
  /** Overshoot très léger (~2-3 %) — logo, badge, CTA. */
  premium: { damping: 16, mass: 1, stiffness: 110 },
  /** Réactif sans rebond — micro-interactions UI. */
  snappy: { damping: 26, mass: 0.6, stiffness: 180 },
  /** Naissance du logo : 0.8 → 1 avec overshoot ~1.5 % de l'échelle finale. */
  birth: { damping: 13, mass: 1, stiffness: 120 },
} satisfies Record<string, SpringCfg>;

export type SpringCfg = { damping: number; mass: number; stiffness: number };

export const sp = (
  frame: number,
  delay: number,
  config: SpringCfg = SPRINGS.smooth,
  durationInFrames?: number,
) => spring({ frame: frame - delay, fps: FPS, config, durationInFrames });

/** Apparition standard : opacité + montée + flou → net. */
export const reveal = (frame: number, start: number, dur = 18, dist = 24, blur = 10) => {
  const p = tween(frame, [start, start + dur], [0, 1]);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * dist}px)`,
    filter: blur ? `blur(${(1 - p) * blur}px)` : undefined,
  } as const;
};

/** Sortie standard : opacité + flou + léger déplacement. */
export const exitStyle = (frame: number, start: number, dur = 16, dy = -18, blur = 10) => {
  const p = tween(frame, [start, start + dur], [0, 1], EASE.in);
  return { opacity: 1 - p, dy: p * dy, blur: p * blur, p };
};

/** Bruit pseudo-aléatoire lisse et déterministe (somme de sinus). */
export const wobble = (frame: number, seed: number, amp = 1) =>
  amp *
  (Math.sin(frame * 0.21 + seed * 1.7) * 0.6 +
    Math.sin(frame * 0.53 + seed * 3.1) * 0.3 +
    Math.sin(frame * 1.37 + seed * 0.7) * 0.1);

/** Déclencheur de glitch : renvoie une intensité 0..1 sur quelques frames. */
export const glitchAt = (frame: number, hits: number[], len = 3) => {
  for (const h of hits) {
    if (frame >= h && frame < h + len) {
      return 1 - (frame - h) / len;
    }
  }
  return 0;
};

export const rand = (seed: string | number) => random(seed);
