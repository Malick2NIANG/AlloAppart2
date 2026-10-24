import React from 'react';
import { GRADIENTS } from '../config/brand';

/**
 * Texte en dégradé doré. `shimmer` (0→1) fait glisser un reflet clair
 * à travers les lettres (reflet unique, jamais en boucle continue).
 */
export const GoldText: React.FC<{
  children: React.ReactNode;
  shimmer?: number;
  style?: React.CSSProperties;
}> = ({ children, shimmer = -1, style }) => {
  const pos = -40 + shimmer * 180; // en %
  const sheen =
    shimmer >= 0 && shimmer <= 1
      ? `linear-gradient(105deg, transparent ${pos - 12}%, rgba(255,250,235,0.95) ${pos}%, transparent ${pos + 12}%), `
      : '';
  return (
    <span
      style={{
        backgroundImage: `${sheen}${GRADIENTS.goldText}`,
        backgroundSize: '100% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        // Évite la coupure des jambages (é, g, ?) avec background-clip.
        paddingBottom: '0.08em',
        ...style,
      }}
    >
      {children}
    </span>
  );
};
