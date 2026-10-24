import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BRAND, FONTS, goldAlpha } from '../config/brand';
import { AUDIO_CUES, T } from '../config/timeline';
import { CenterAt, useFormat } from '../lib/format';
import { EASE, SPRINGS, sp, tween } from '../lib/anim';
import { LogoLockup } from '../components/Logo';
import { GoldText } from '../components/GoldText';
import { CtaButton } from '../components/CtaButton';

/**
 * ACTE 4 — CALL TO ACTION (frames 450 → 600)
 *   454-476  retour du logo (lockup officiel)
 *   470-492  slogan officiel (2 lignes), reflet doré sur "idéal au Sénégal"
 *   496      CTA alloappart.sn (overshoot léger, glow, micro-pulse)
 *   512      "Louez en toute confiance."
 *   564-596  sortie en cascade inverse → retour au bleu nuit (boucle)
 */
export const Act4Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { layout } = useFormat();
  if (frame < 450) return null;
  const L = layout.act4;

  // Sortie de boucle : cascade inverse (tagline → CTA → slogan → logo)
  const out = (d: number) => tween(frame, [T.loopOut.start + d, T.loopOut.start + d + 20], [0, 1], EASE.inOut);

  const logo = sp(frame, 454, SPRINGS.premium);
  const logoO = tween(frame, [454, 468], [0, 1]);
  const l1 = sp(frame, AUDIO_CUES.slogan - 2, SPRINGS.smooth);
  const l2 = sp(frame, AUDIO_CUES.slogan + 8, SPRINGS.smooth);
  const shimmer = tween(frame, [488, 520], [0, 1], EASE.inOut);

  const cta = sp(frame, AUDIO_CUES.cta, SPRINGS.premium);
  const ctaO = tween(frame, [AUDIO_CUES.cta, AUDIO_CUES.cta + 10], [0, 1]);
  const ctaPulse = frame > 522 ? Math.sin(((frame - 522) / 30) * Math.PI * 2) * 0.5 + 0.5 : 0;
  const ctaGlow = tween(frame, [500, 514], [0, 1]) * (0.6 + 0.4 * ctaPulse);
  const ctaSweep = tween(frame, [512, 538], [0, 1], EASE.inOut);
  const arrow = tween(frame, [518, 528], [0, 1], EASE.out) * (1 - tween(frame, [532, 544], [0, 1], EASE.inOut));

  const tag = sp(frame, 512, SPRINGS.smooth);

  const o = (base: number, d: number) => base * (1 - out(d));
  const b = (inP: number, d: number) => `blur(${(1 - inP) * 10 + out(d) * 12}px)`;

  const drift = 1 + tween(frame, [470, 596], [0, 0.025], EASE.inOut);

  return (
    <AbsoluteFill style={{ transform: `scale(${drift})` }}>
      {/* Halo central du logo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 40% 35% at 50% 30%, ${goldAlpha(0.12)} 0%, rgba(15,23,42,0) 70%)`,
          opacity: logoO * (1 - out(12)),
        }}
      />

      <CenterAt y={L.logo}>
        <div
          style={{
            opacity: o(logoO, 12),
            transform: `scale(${(0.9 + logo * 0.1) * (1 - out(12) * 0.05)})`,
            filter: b(logoO, 12),
          }}
        >
          <LogoLockup size={440} glow={0.6 + 0.3 * Math.sin(frame * 0.08) ** 2} />
        </div>
      </CenterAt>

      <CenterAt y={L.slogan}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontFamily: FONTS.poppins,
            fontWeight: 700,
            fontSize: 80,
            lineHeight: 1.08,
            letterSpacing: -2,
            color: BRAND.surface,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              opacity: o(tween(frame, [AUDIO_CUES.slogan - 2, AUDIO_CUES.slogan + 10], [0, 1]), 6),
              transform: `translateY(${(1 - l1) * 30}px)`,
              filter: b(l1, 6),
            }}
          >
            Trouvez votre logement
          </span>
          <span
            style={{
              opacity: o(tween(frame, [AUDIO_CUES.slogan + 8, AUDIO_CUES.slogan + 20], [0, 1]), 6),
              transform: `translateY(${(1 - l2) * 30}px)`,
              filter: b(l2, 6),
            }}
          >
            <GoldText shimmer={shimmer}>idéal au Sénégal</GoldText>
          </span>
        </div>
      </CenterAt>

      <CenterAt y={L.cta}>
        <div
          style={{
            opacity: o(ctaO, 3),
            transform: `translateY(${(1 - cta) * 24}px) scale(${(0.86 + cta * 0.14) * (1 + ctaPulse * 0.015)})`,
            filter: b(ctaO, 3),
          }}
        >
          <CtaButton glow={ctaGlow} sweep={ctaSweep} arrow={arrow} />
        </div>
      </CenterAt>

      <CenterAt y={L.tagline}>
        <div
          style={{
            fontFamily: FONTS.inter,
            fontWeight: 500,
            fontSize: 30,
            letterSpacing: 0.2,
            color: BRAND.darkText,
            opacity: o(tag * 0.85, 0),
            transform: `translateY(${(1 - tag) * 16}px)`,
            filter: b(tag, 0),
          }}
        >
          Louez en toute confiance.
        </div>
      </CenterAt>
    </AbsoluteFill>
  );
};
