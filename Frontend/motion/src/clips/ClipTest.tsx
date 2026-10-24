import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { Background } from '../components/Background';
import { LogoLockup } from '../components/Logo';
import { GoldText } from '../components/GoldText';

// Clip de test (PROMPT 02) — page Annonces en mobile (défilement +
// ouverture d'une annonce), gabarit « téléphone sur fond de marque »
// (PLAN_CAPTURE.md § 1, cadrage A). 150 frames à 30 i/s = 5 s, dont 0,5 s
// d'image stable au début et à la fin (règle du chantier mobile).
//
// Source : public/captures/test/video.mp4 (30 i/s constants, converti
// depuis la capture Playwright brute par scripts/to-cfr.mjs). Fenêtre
// choisie dans marks.json : à partir de « listings_ready » (page chargée,
// squelettes disparus), vitesse 1,2× (reste dans la fourchette 1–1,25×
// autorisée) pour tenir dans les 5 s du clip de test.

const FPS = 30;
const SOURCE_START_MS = 4930; // mark "listings_ready"
const PLAYBACK_RATE = 1.2;

export const ClipTest: React.FC = () => {
  const frame = useCurrentFrame();

  // Fenêtre téléphone : x ≈ (1080-485)/2, y 450→1500 (≈485×1050),
  // gabarit du § 1 de PLAN_CAPTURE.md.
  const phoneWidth = 485;
  const phoneHeight = 1050;
  const phoneX = (1080 - phoneWidth) / 2;
  const phoneY = 450;

  // Légère apparition du cadre téléphone + titre (pas un simple cut).
  const introOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Background />

      <AbsoluteFill style={{ alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: introOpacity }}>
          <LogoLockup size={72} />
        </div>

        <div
          style={{
            position: 'absolute', top: 270, left: 60, right: 60,
            textAlign: 'center', opacity: introOpacity,
          }}
        >
          <GoldText style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 56, lineHeight: 1.15 }}>
            Trouvez votre logement idéal
          </GoldText>
        </div>

        {/* Cadre téléphone générique (rectangle arrondi, liseré or) */}
        <div
          style={{
            position: 'absolute', left: phoneX, top: phoneY,
            width: phoneWidth, height: phoneHeight,
            borderRadius: 36, overflow: 'hidden',
            border: '3px solid #facc15',
            boxShadow: '0 0 0 1px rgba(250,204,21,0.25), 0 30px 60px rgba(0,0,0,0.5)',
            opacity: introOpacity,
            background: '#0f172a',
          }}
        >
          <OffthreadVideo
            src={staticFile('captures/test/video.mp4')}
            startFrom={Math.round((SOURCE_START_MS / 1000) * FPS)}
            playbackRate={PLAYBACK_RATE}
            muted
            style={{ width: phoneWidth, height: phoneHeight, objectFit: 'cover', objectPosition: 'top center' }}
          />
        </div>

        {/* Mention « données de démonstration » (PLAN_DEMO.md D8) */}
        <div
          style={{
            position: 'absolute', bottom: 60, left: 0, right: 0,
            textAlign: 'center', opacity: introOpacity * 0.75,
            fontFamily: 'Inter, sans-serif', fontSize: 20, color: '#e2e8f0',
          }}
        >
          Annonces et données de démonstration
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
