import React from 'react';

/**
 * Reflet lumineux qui traverse un élément (à placer dans un parent
 * `position: relative; overflow: hidden`). progress 0→1.
 */
export const LightSweep: React.FC<{
  progress: number;
  width?: string;
  intensity?: number;
  angle?: number;
  radius?: number;
}> = ({ progress, width = '35%', intensity = 0.55, angle = 20, radius }) => {
  if (progress <= 0 || progress >= 1) return null;
  const x = -60 + progress * 220; // %
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        borderRadius: radius,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          bottom: '-50%',
          width,
          left: `${x}%`,
          transform: `skewX(-${angle}deg)`,
          background: `linear-gradient(90deg, rgba(255,245,214,0) 0%, rgba(255,245,214,${intensity}) 50%, rgba(255,245,214,0) 100%)`,
        }}
      />
    </div>
  );
};
