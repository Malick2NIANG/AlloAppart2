import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BRAND, FONTS, goldAlpha } from '../config/brand';
import { LOGO_PNG_GEOMETRY as PG, LOGO_SVG, LOGO_SVG_GEOMETRY as SG } from '../assets';
import { CenterAt, useFormat } from '../lib/format';
import { EASE, SPRINGS, sp, tween } from '../lib/anim';
import { HouseMark, LogoLockup } from '../components/Logo';
import { GoldText } from '../components/GoldText';
import { VerifiedBadge } from '../components/VerifiedBadge';

/**
 * ACTE 2 — RÉVÉLATION ALLOAPPART (frames 120 → 270)
 *   116-150  la maison (SVG, nette à toute échelle) naît de la lumière
 *            scale 0.8 → 1 avec overshoot ~1.5 %, puis micro-pulse
 *   138-164  reflet lumineux dans le logo
 *   152-180  travelling : la maison rejoint sa place dans le lockup
 *   162-188  le texte du logo (PNG officiel) se révèle en balayage
 *   174-184  fondu SVG → PNG (le lockup officiel prend le relais)
 *   182+     "AlloAppart arrive." / sous-titre / badge AlloVérifié™ (204)
 *   250-270  sortie vers l'acte 3
 */

const LOCKUP = 520; // côté de la boîte PNG (échelle 1.04 → net)
const BIG = 300; // taille de la maison SVG au moment de la révélation

// Géométrie de raccord SVG → PNG
const pngHouseH = ((PG.house.y1 - PG.house.y0 + 1) * LOCKUP) / PG.size;
const pngHouseW = ((PG.house.x1 - PG.house.x0 + 1) * LOCKUP) / PG.size;
const svgHouseRatioH = (SG.house.y1 - SG.house.y0) / SG.viewBox; // 0.75
const svgHouseRatioW = (SG.house.x1 - SG.house.x0 + 1.2) / SG.viewBox;
const SMALL = pngHouseH / svgHouseRatioH;
const SCALE_X_FIX = pngHouseW / (svgHouseRatioW * SMALL);
const houseDx = (((PG.house.x0 + PG.house.x1) / 2 - PG.size / 2) * LOCKUP) / PG.size;
const houseDy = (((PG.house.y0 + PG.house.y1) / 2 - PG.size / 2) * LOCKUP) / PG.size;
// Centre optique du SVG : la maison est centrée dans le viewBox (y 8→56 → 32).

export const Act2Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { layout, cx, cy } = useFormat();
  if (frame < 112 || frame > 276) return null;

  const L = layout.act2;

  /* ── Maison SVG ── */
  const birth = sp(frame, 116, SPRINGS.birth);
  const pulse = Math.sin(tween(frame, [146, 164], [0, Math.PI], EASE.inOut)) * 0.02;
  const bigScale = 0.8 + birth * 0.2 + pulse;
  const houseO = tween(frame, [116, 132], [0, 1]);
  const houseBlur = tween(frame, [116, 140], [24, 0]);

  const travel = tween(frame, [152, 180], [0, 1], EASE.inOut);
  const startX = cx;
  const startY = cy - 30;
  const endX = cx + houseDx;
  const endY = cy + L.logo + houseDy;
  const hx = startX + (endX - startX) * travel;
  // Arc léger (travelling plus organique qu'une ligne droite)
  const hy = startY + (endY - startY) * travel - Math.sin(travel * Math.PI) * 18;
  const size = BIG + (SMALL - BIG) * travel;
  const scaleX = 1 + (SCALE_X_FIX - 1) * travel;
  const svgOut = tween(frame, [176, 186], [1, 0], EASE.inOut);

  /* ── Halo derrière la maison ── */
  const haloO = tween(frame, [118, 140], [0, 1]) * (1 - travel * 0.45) + pulse * 12;

  /* ── Lockup PNG ── */
  const textReveal = tween(frame, [162, 188], [0, 1], EASE.inOut);
  const pngHouse = tween(frame, [174, 184], [0, 1], EASE.inOut);
  const lockGlow = tween(frame, [180, 196], [0, 1]) * (0.55 + 0.45 * Math.sin(frame * 0.09) ** 2);

  /* ── Sortie ── */
  const exit = (d: number) => tween(frame, [250 + d, 268 + d], [0, 1], EASE.in);

  /* ── Textes ── */
  const h = sp(frame, 182, SPRINGS.smooth);
  const sub = sp(frame, 192, SPRINGS.smooth);
  const badgeIn = sp(frame, 204, SPRINGS.premium);
  const check = tween(frame, [210, 226], [0, 1], EASE.inOut);
  const sweep = tween(frame, [224, 246], [0, 1], EASE.inOut);
  const badgeGlow = tween(frame, [218, 232], [0, 1]) * (1 - 0.3 * tween(frame, [238, 250], [0, 1]));

  const sheen = tween(frame, [138, 164], [0, 1], EASE.inOut);

  const logoExit = exit(4);

  // Respiration de caméra très lente une fois le lockup posé.
  const drift = 1 + tween(frame, [184, 262], [0, 0.018], EASE.inOut);

  return (
    <AbsoluteFill style={{ transform: `scale(${drift})` }}>
      {/* Halo doré qui suit la maison */}
      <div
        style={{
          position: 'absolute',
          left: hx - 380,
          top: hy - 380,
          width: 760,
          height: 760,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${goldAlpha(0.3)} 0%, ${goldAlpha(0.1)} 35%, rgba(15,23,42,0) 68%)`,
          opacity: Math.max(0, haloO) * (1 - logoExit),
          filter: 'blur(10px)',
        }}
      />

      {/* Lockup officiel PNG */}
      <CenterAt y={L.logo}>
        <div
          style={{
            opacity: 1 - logoExit,
            transform: `translateY(${-logoExit * 30}px) scale(${1 - logoExit * 0.06})`,
            filter: `blur(${logoExit * 10}px)`,
          }}
        >
          <LogoLockup size={LOCKUP} houseOpacity={pngHouse} textReveal={textReveal} glow={lockGlow} />
        </div>
      </CenterAt>

      {/* Maison vectorielle (révélation + travelling) */}
      {svgOut > 0 && (
        <div
          style={{
            position: 'absolute',
            left: hx - size / 2,
            top: hy - size / 2,
            width: size,
            height: size,
            opacity: houseO * svgOut,
            transform: `scale(${bigScale * scaleX}, ${bigScale})`,
            filter: `blur(${houseBlur}px) drop-shadow(0 0 ${30 * (1 - travel * 0.6)}px ${goldAlpha(0.45)})`,
          }}
        >
          <HouseMark size={size} />
          {/* Reflet lumineux masqué par la forme du logo */}
          {sheen > 0 && sheen < 1 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                WebkitMaskImage: `url(${LOGO_SVG})`,
                maskImage: `url(${LOGO_SVG})`,
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
                background: `linear-gradient(115deg, rgba(255,255,255,0) ${sheen * 160 - 40}%, rgba(255,250,235,0.85) ${sheen * 160 - 20}%, rgba(255,255,255,0) ${sheen * 160}%)`,
              }}
            />
          )}
        </div>
      )}

      {/* Titre */}
      <CenterAt y={L.headline}>
        <div
          style={{
            fontFamily: FONTS.poppins,
            fontWeight: 700,
            fontSize: 72,
            letterSpacing: -1.6,
            lineHeight: 1.1,
            color: BRAND.surface,
            whiteSpace: 'nowrap',
            opacity: h * (1 - exit(0)),
            transform: `translateY(${(1 - h) * 26 - exit(0) * 24}px)`,
            filter: `blur(${(1 - h) * 10 + exit(0) * 10}px)`,
          }}
        >
          <GoldText shimmer={tween(frame, [190, 220], [0, 1], EASE.inOut)}>AlloAppart</GoldText> arrive.
        </div>
      </CenterAt>

      {/* Sous-titre */}
      <CenterAt y={L.sub}>
        <div
          style={{
            fontFamily: FONTS.inter,
            fontWeight: 500,
            fontSize: 31,
            letterSpacing: -0.2,
            color: BRAND.darkText,
            whiteSpace: 'nowrap',
            opacity: sub * 0.9 * (1 - exit(0)),
            transform: `translateY(${(1 - sub) * 18 - exit(0) * 20}px)`,
            filter: `blur(${(1 - sub) * 8 + exit(0) * 10}px)`,
          }}
        >
          Chaque bien vérifié sur place par un agent terrain certifié.
        </div>
      </CenterAt>

      {/* Badge AlloVérifié™ */}
      <CenterAt y={L.badge}>
        <div
          style={{
            opacity: tween(frame, [204, 214], [0, 1]) * (1 - exit(2)),
            transform: `translateY(${(1 - badgeIn) * 26 - exit(2) * 20}px) scale(${0.9 + badgeIn * 0.1})`,
            filter: `blur(${tween(frame, [204, 216], [8, 0]) + exit(2) * 10}px)`,
          }}
        >
          <VerifiedBadge check={check} sweep={sweep} glow={badgeGlow} />
        </div>
      </CenterAt>
    </AbsoluteFill>
  );
};
