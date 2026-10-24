import React, { createContext, useContext } from 'react';
import { useVideoConfig } from 'remotion';
import { FORMATS, type Format } from '../config/formats';

const FormatContext = createContext<Format>(FORMATS['16x9']);

export const FormatProvider: React.FC<{ format: Format; children: React.ReactNode }> = ({
  format,
  children,
}) => <FormatContext.Provider value={format}>{children}</FormatContext.Provider>;

export const useFormat = () => {
  const format = useContext(FormatContext);
  const { width, height } = useVideoConfig();
  return { ...format, width, height, cx: width / 2, cy: height / 2 };
};

/**
 * Place ses enfants centrés horizontalement, avec leur centre vertical à
 * `y` px du centre de l'image. Toute la mise en page passe par ce composant
 * → adaptation 9:16 / 1:1 = changer des offsets, pas du code.
 */
export const CenterAt: React.FC<{
  y: number;
  x?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ y, x = 0, style, children }) => {
  const { cy } = useFormat();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: cy + y,
        height: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: x ? `translateX(${x}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
