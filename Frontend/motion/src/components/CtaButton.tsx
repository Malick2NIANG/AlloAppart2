import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BRAND, GRADIENTS, goldAlpha, FONTS } from '../config/brand';
import { LightSweep } from './LightSweep';

/** Bouton principal — même dégradé et même texte que .btn-gold du site. */
export const CtaButton: React.FC<{ glow: number; sweep: number; arrow: number }> = ({
  glow,
  sweep,
  arrow,
}) => (
  <div
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '24px 46px 24px 52px',
      borderRadius: 999,
      background: GRADIENTS.button,
      color: BRAND.buttonText,
      fontFamily: FONTS.poppins,
      fontWeight: 600,
      fontSize: 42,
      letterSpacing: -0.2,
      lineHeight: 1,
      boxShadow: `0 18px 40px -12px ${goldAlpha(0.55)}, 0 0 ${70 * glow}px ${goldAlpha(0.35 * glow)}, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(181,137,0,0.35)`,
    }}
  >
    <span>alloappart.sn</span>
    <ArrowRight
      size={36}
      strokeWidth={2.4}
      color={BRAND.buttonText}
      style={{ transform: `translateX(${arrow * 6}px)` }}
    />
    <LightSweep progress={sweep} radius={999} intensity={0.7} width="28%" />
  </div>
);
