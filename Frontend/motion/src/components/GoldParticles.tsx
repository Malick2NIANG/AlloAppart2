import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { rand, tween, EASE } from '../lib/anim';
import { warmth } from '../lib/warmth';
import { useFormat } from '../lib/format';

type P = { x: number; y: number; r: number; speed: number; phase: number; tw: number };

/**
 * 1) Poussière dorée ambiante (actes 2-4) : très fine, lente, montante.
 * 2) Burst de révélation (frame ~118) : particules émises du centre.
 */
export const GoldParticles: React.FC<{ burstAt: number }> = ({ burstAt }) => {
  const frame = useCurrentFrame();
  const { width, height, cx, cy } = useFormat();
  const w = warmth(frame);

  const ambient = useMemo<P[]>(
    () =>
      new Array(46).fill(0).map((_, i) => ({
        x: rand(`ax${i}`) * width,
        y: rand(`ay${i}`) * height,
        r: 0.8 + rand(`ar${i}`) * 1.8,
        speed: 0.25 + rand(`as${i}`) * 0.6,
        phase: rand(`ap${i}`) * Math.PI * 2,
        tw: 0.03 + rand(`at${i}`) * 0.05,
      })),
    [width, height],
  );

  const burst = useMemo(
    () =>
      new Array(70).fill(0).map((_, i) => {
        const a = rand(`ba${i}`) * Math.PI * 2;
        return {
          a,
          dist: 180 + rand(`bd${i}`) * 620,
          r: 0.8 + rand(`br${i}`) * 2,
          delay: rand(`bl${i}`) * 10,
          life: 40 + rand(`bf${i}`) * 40,
        };
      }),
    [],
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, mixBlendMode: 'plus-lighter' }}>
        <defs>
          <radialGradient id="pGlow">
            <stop offset="0%" stopColor="#fff5d6" stopOpacity="1" />
            <stop offset="45%" stopColor="#facc15" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
          </radialGradient>
        </defs>
        {w > 0.001 &&
          ambient.map((p, i) => {
            const y = (((p.y - frame * p.speed) % height) + height) % height;
            const x = p.x + Math.sin(frame * 0.02 + p.phase) * 14;
            const twinkle = 0.45 + 0.55 * Math.sin(frame * p.tw * 2 + p.phase) ** 2;
            // Atténuation au centre pour ne pas gêner la lecture.
            const d = Math.hypot(x - cx, y - cy) / (width * 0.5);
            const edge = Math.min(1, 0.25 + d * 1.1);
            return (
              <circle key={i} cx={x} cy={y} r={p.r * 2.4} fill="url(#pGlow)" opacity={w * twinkle * edge * 0.55} />
            );
          })}
        {burst.map((b, i) => {
          const t = frame - burstAt - b.delay;
          if (t < 0 || t > b.life) return null;
          const k = tween(t, [0, b.life], [0, 1], EASE.out);
          const r0 = 150; // naissent autour du logo, jamais par-dessus
          const x = cx + Math.cos(b.a) * (r0 + b.dist * k);
          const y = cy - 30 + Math.sin(b.a) * (r0 + b.dist * k) * 0.72 - t * 0.4;
          const o = tween(t, [0, 6], [0, 1]) * (1 - tween(t, [b.life * 0.4, b.life], [0, 1]));
          return <circle key={`b${i}`} cx={x} cy={y} r={b.r * 2.6} fill="url(#pGlow)" opacity={o * 0.9} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
