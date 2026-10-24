import React from 'react';
import { Img } from 'remotion';
import { LOGO_PNG, LOGO_PNG_GEOMETRY as G, LOGO_SVG } from '../assets';

const CUT = (G.textStartX / G.size) * 100; // % de la largeur où commence le texte

/**
 * Lockup officiel (LOGO.png) — jamais sur plaque blanche.
 * Deux calques du même PNG, découpés par masque :
 *   - la maison (opacité `houseOpacity`, pour le fondu SVG → PNG),
 *   - le texte "LLO / PPART" révélé en balayage (`textReveal` 0→1).
 * `size` = côté de la boîte 500×500 affichée (≤ 540 px pour rester net).
 */
export const LogoLockup: React.FC<{
  size: number;
  houseOpacity?: number;
  textReveal?: number;
  glow?: number;
  style?: React.CSSProperties;
}> = ({ size, houseOpacity = 1, textReveal = 1, glow = 0, style }) => {
  const shadow =
    glow > 0
      ? `drop-shadow(0 0 ${18 * glow}px rgba(250, 204, 21, ${0.35 * glow})) drop-shadow(0 0 ${60 * glow}px rgba(250, 204, 21, ${0.18 * glow}))`
      : undefined;
  const common: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: size,
    height: size,
  };
  // Front de balayage adouci (bord progressif de 7 %), jamais une coupe nette.
  const edge = CUT + textReveal * (100 - CUT + 8);
  const textMask = `linear-gradient(90deg, transparent ${CUT}%, black ${CUT}%, black ${edge - 8}%, transparent ${edge}%)`;
  return (
    <div style={{ position: 'relative', width: size, height: size, filter: shadow, ...style }}>
      <Img
        src={LOGO_PNG}
        style={{ ...common, opacity: houseOpacity, clipPath: `inset(0 ${100 - CUT}% 0 0)` }}
      />
      {textReveal > 0 && (
        <Img
          src={LOGO_PNG}
          style={{ ...common, maskImage: textMask, WebkitMaskImage: textMask }}
        />
      )}
    </div>
  );
};

/**
 * Maison vectorielle (favicon.svg) — utilisée pour les grands zooms /
 * travellings afin de rester parfaitement nette à toute échelle.
 */
export const HouseMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={LOGO_SVG} style={{ width: size, height: size, display: 'block', ...style }} />
);
