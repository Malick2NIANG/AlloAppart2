import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BRAND } from '../config/brand';
import { DURATION } from '../config/timeline';
import { warmth } from '../lib/warmth';
import { tween } from '../lib/anim';

const CELL = 88;

/**
 * Fond persistant sur toute la durée : bleu nuit, grille technologique,
 * halo froid (acte 1) → halo doré (actes 2-4), vignette.
 * La grille dérive d'exactement 1 cellule en 600 frames → boucle parfaite.
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const w = warmth(frame);
  const drift = (frame / DURATION) * CELL;
  // Instabilité de l'acte 1 : la grille respire légèrement.
  const cold = 1 - w;
  const pulse = tween(frame, [96, 124], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.navy, overflow: 'hidden' }}>
      {/* Halo froid (acte 1) */}
      <AbsoluteFill
        style={{
          opacity: cold,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(51, 65, 85, 0.55) 0%, rgba(15, 23, 42, 0) 70%)',
        }}
      />
      {/* Halo doré (univers AlloAppart) */}
      <AbsoluteFill
        style={{
          opacity: w,
          background: `radial-gradient(ellipse 55% 50% at 50% 46%, rgba(250, 204, 21, 0.13) 0%, rgba(181, 137, 0, 0.05) 45%, rgba(15, 23, 42, 0) 75%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: w * 0.9,
          background:
            'radial-gradient(ellipse 90% 40% at 50% 110%, rgba(181, 137, 0, 0.12) 0%, rgba(15, 23, 42, 0) 70%)',
        }}
      />
      {/* Grille */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(226,232,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,1) 1px, transparent 1px)`,
          backgroundSize: `${CELL}px ${CELL}px`,
          backgroundPosition: `${drift}px ${drift * 0.5}px`,
          opacity: 0.028 + cold * 0.012 + pulse * (1 - pulse) * 0.03,
          maskImage: 'radial-gradient(ellipse 65% 60% at 50% 50%, black 20%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 65% 60% at 50% 50%, black 20%, transparent 80%)',
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 85% 80% at 50% 50%, rgba(2,6,23,0) 55%, rgba(2,6,23,0.75) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
