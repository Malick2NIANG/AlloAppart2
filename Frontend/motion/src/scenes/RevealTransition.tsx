import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { T } from '../config/timeline';
import { EASE, tween } from '../lib/anim';
import { useFormat } from '../lib/format';

/**
 * TRANSITION DE RÉVÉLATION (frames ~100 → 160, pic à 121)
 * La lumière dorée entre par la gauche, balaie l'obscurité de l'acte 1,
 * puis se concentre en halo au centre, où naît le logo.
 *   1. balayage diagonal (sweep)            100 → 132
 *   2. halo radial qui s'ouvre              112 → 150
 *   3. flash contrôlé (pâle, jamais blanc pur) pic 121
 *   4. anneau d'onde très fin               118 → 150
 */
export const RevealTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, cx, cy } = useFormat();
  if (frame < T.reveal.start || frame > T.reveal.end) return null;

  // 1. Sweep
  const sweep = tween(frame, [100, 132], [0, 1], EASE.inOut);
  const bandW = width * 0.34;
  const sweepX = -bandW + sweep * (width + bandW * 2) - bandW * 0.5;
  // Front de lumière en % de largeur (pour le sillage chaud).
  const front = ((sweepX + bandW / 2) / width) * 100;
  const trailO = tween(frame, [100, 106], [0, 1]) * (1 - tween(frame, [132, 152], [0, 1], EASE.inOut));
  const sweepO = tween(frame, [100, 108], [0, 1]) * (1 - tween(frame, [124, 134], [0, 1]));

  // 2. Halo
  const haloS = tween(frame, [110, 150], [0.2, 1.25], EASE.out);
  const haloO = tween(frame, [110, 121], [0, 0.75]) * (1 - tween(frame, [124, 158], [0, 0.85], EASE.inOut));

  // 3. Flash
  const flash = tween(frame, [116, 121], [0, 1], EASE.out) * (1 - tween(frame, [121, 138], [0, 1], EASE.soft));

  // 4. Anneau
  const ring = tween(frame, [118, 152], [0, 1], EASE.out);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Sillage chaud : l'obscurité est "chassée" derrière le front de lumière */}
      <AbsoluteFill
        style={{
          opacity: trailO,
          background:
            'radial-gradient(ellipse 60% 55% at 50% 46%, rgba(250,204,21,0.16) 0%, rgba(250,204,21,0.05) 50%, rgba(250,204,21,0.02) 100%)',
          maskImage: `linear-gradient(104deg, black ${front - 18}%, transparent ${front + 2}%)`,
          WebkitMaskImage: `linear-gradient(104deg, black ${front - 18}%, transparent ${front + 2}%)`,
        }}
      />
      {/* Sweep diagonal : cœur pâle lumineux, bords dorés, fusion additive */}
      <div
        style={{
          position: 'absolute',
          top: -height * 0.5,
          height: height * 2,
          left: sweepX,
          width: bandW,
          transform: 'rotate(14deg)',
          opacity: sweepO,
          background:
            'linear-gradient(90deg, rgba(250,204,21,0) 0%, rgba(250,204,21,0.10) 28%, rgba(250,204,21,0.35) 44%, rgba(255,245,214,0.6) 50%, rgba(250,204,21,0.35) 56%, rgba(250,204,21,0.10) 72%, rgba(250,204,21,0) 100%)',
          filter: 'blur(26px)',
          mixBlendMode: 'plus-lighter',
        }}
      />
      {/* Halo radial */}
      <div
        style={{
          position: 'absolute',
          left: cx - 700,
          top: cy - 700,
          width: 1400,
          height: 1400,
          borderRadius: '50%',
          transform: `scale(${haloS})`,
          opacity: haloO,
          background:
            'radial-gradient(circle, rgba(255,245,214,0.42) 0%, rgba(250,204,21,0.26) 14%, rgba(250,204,21,0.08) 36%, rgba(15,23,42,0) 62%)',
          mixBlendMode: 'plus-lighter',
        }}
      />
      {/* Anneau d'onde */}
      <div
        style={{
          position: 'absolute',
          left: cx - 420,
          top: cy - 420,
          width: 840,
          height: 840,
          borderRadius: '50%',
          border: '1.5px solid rgba(249,228,183,0.7)',
          transform: `scale(${0.15 + ring * 1.6})`,
          opacity: (1 - ring) * tween(frame, [118, 121], [0, 1]) * 0.6,
          filter: 'blur(1px)',
        }}
      />
      {/* Flash contrôlé */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 47%, rgba(255,245,214,0.9) 0%, rgba(250,204,21,0.35) 22%, rgba(250,204,21,0) 52%)',
          opacity: flash * 0.5,
          mixBlendMode: 'plus-lighter',
        }}
      />
    </AbsoluteFill>
  );
};
