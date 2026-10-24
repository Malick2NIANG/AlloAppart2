import React from 'react';
import { Shield } from 'lucide-react';
import { BRAND, GRADIENTS, goldAlpha, paleAlpha, FONTS } from '../config/brand';
import { tween, EASE } from '../lib/anim';
import { LightSweep } from './LightSweep';

/**
 * Badge AlloVérifié™ — élément signature de la marque.
 *   check   : 0→1 tracé de la coche dans le bouclier
 *   sweep   : 0→1 reflet lumineux
 *   glow    : intensité du halo
 */
export const ShieldCheckMark: React.FC<{
  size: number;
  check: number;
  color?: string;
  checkColor?: string;
  strokeWidth?: number;
}> = ({ size, check, color = BRAND.gold, checkColor = BRAND.goldPale, strokeWidth = 2 }) => {
  const len = 14;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <Shield size={size} color={color} strokeWidth={strokeWidth} fill={goldAlpha(0.14)} />
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0 }}
        fill="none"
        stroke={checkColor}
        strokeWidth={strokeWidth + 0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 12.2l2.4 2.4 4.8-5" strokeDasharray={len} strokeDashoffset={len * (1 - check)} />
      </svg>
    </div>
  );
};

export const VerifiedBadge: React.FC<{
  check: number;
  sweep: number;
  glow: number;
  label?: string;
  scale?: number;
}> = ({ check, sweep, glow, label = 'Vérification terrain', scale = 1 }) => {
  const labelIn = tween(check, [0.4, 1], [0, 1], EASE.out);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 18 * scale,
        padding: `${14 * scale}px ${30 * scale}px ${14 * scale}px ${16 * scale}px`,
        borderRadius: 999,
        background: `linear-gradient(180deg, ${goldAlpha(0.12)}, ${goldAlpha(0.04)})`,
        border: `1px solid ${goldAlpha(0.42)}`,
        boxShadow: `0 0 ${40 * glow}px ${goldAlpha(0.28 * glow)}, inset 0 1px 0 ${paleAlpha(0.18)}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: 56 * scale,
          height: 56 * scale,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(circle at 35% 30%, ${goldAlpha(0.35)}, ${goldAlpha(0.08)} 70%)`,
          boxShadow: `0 0 ${24 * glow}px ${goldAlpha(0.45 * glow)}`,
        }}
      >
        <ShieldCheckMark size={32 * scale} check={check} />
      </div>
      <span
        style={{
          fontFamily: FONTS.poppins,
          fontWeight: 600,
          fontSize: 32 * scale,
          letterSpacing: -0.3,
          backgroundImage: GRADIENTS.goldText,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}
      >
        AlloVérifié™
      </span>
      <span
        style={{
          width: 1,
          height: 28 * scale,
          background: goldAlpha(0.3),
          opacity: labelIn,
        }}
      />
      <span
        style={{
          fontFamily: FONTS.inter,
          fontWeight: 500,
          fontSize: 21 * scale,
          color: BRAND.darkText,
          opacity: 0.85 * labelIn,
          transform: `translateX(${(1 - labelIn) * -8}px)`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <LightSweep progress={sweep} radius={999} intensity={0.35} />
    </div>
  );
};
