import React from 'react';
import { Composition } from 'remotion';
import { AlloAppartAd } from './AlloAppartAd';
import { ClipTest } from './clips/ClipTest';
import { DURATION, FPS } from './config/timeline';
import { FORMATS } from './config/formats';

/**
 * Compositions disponibles.
 * Pour produire plus tard le 9:16 et le 1:1 : dupliquer la composition
 * ci-dessous avec format '9x16' / '1x1' (dimensions lues dans FORMATS),
 * puis affiner les offsets de config/formats.ts.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="AlloAppartLaunch16x9"
      component={AlloAppartAd}
      durationInFrames={DURATION}
      fps={FPS}
      width={FORMATS['16x9'].width}
      height={FORMATS['16x9'].height}
      defaultProps={{ format: '16x9', withAudio: true }}
    />
    {/* Clip de test (prompt 02) — page Annonces mobile, 5 s, 9:16. */}
    <Composition
      id="ClipTest"
      component={ClipTest}
      durationInFrames={150}
      fps={30}
      width={FORMATS['9x16'].width}
      height={FORMATS['9x16'].height}
    />
  </>
);
