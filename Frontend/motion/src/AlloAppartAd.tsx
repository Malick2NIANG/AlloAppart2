import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { FORMATS, type FormatId } from './config/formats';
import { FormatProvider } from './lib/format';
import './lib/fonts';
import { Background } from './components/Background';
import { GoldParticles } from './components/GoldParticles';
import { Grain } from './components/Grain';
import { Act1Problem } from './scenes/Act1Problem';
import { RevealTransition } from './scenes/RevealTransition';
import { Act2Reveal } from './scenes/Act2Reveal';
import { Act3Features } from './scenes/Act3Features';
import { Act4Cta } from './scenes/Act4Cta';
import { AUDIO_CUES } from './config/timeline';

export type AdProps = {
  format: FormatId;
  withAudio: boolean;
};

/**
 * Publicité de lancement AlloAppart — 20 s, 600 frames.
 * Ordre des calques (bas → haut) :
 *   fond → actes → transition lumineuse → particules → grain
 */
export const AlloAppartAd: React.FC<AdProps> = ({ format, withAudio }) => (
  <FormatProvider format={FORMATS[format]}>
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Background />
      <Act1Problem />
      <Act2Reveal />
      <Act3Features />
      <Act4Cta />
      <RevealTransition />
      <GoldParticles burstAt={AUDIO_CUES.revealImpact - 3} />
      <Grain opacity={0.045} />
      {withAudio && <Audio src={staticFile('audio/soundtrack.wav')} />}
    </AbsoluteFill>
  </FormatProvider>
);
