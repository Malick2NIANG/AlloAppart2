import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Check, CircleCheck, Lock, MessageCircle, Search, Shield, Wallet } from 'lucide-react';
import { BRAND, FONTS, SHAPE, goldAlpha, paleAlpha, slateAlpha } from '../config/brand';
import { AUDIO_CUES } from '../config/timeline';
import { CenterAt, useFormat } from '../lib/format';
import { EASE, SPRINGS, sp, tween, wobble } from '../lib/anim';
import { GoldText } from '../components/GoldText';
import { ShieldCheckMark } from '../components/VerifiedBadge';
import { LightSweep } from '../components/LightSweep';

/**
 * ACTE 3 — FONCTIONNALITÉS (frames 270 → 450)
 * Titre, puis 4 cartes UI en stagger. Chaque carte "s'active" à tour de
 * rôle (bordure dorée + micro-démo) : l'œil est guidé, jamais tout bouge
 * en même temps.
 *   carte 1 Recherche     démo 298 → 346
 *   carte 2 AlloVérifié™  démo 330 → 376
 *   carte 3 Messagerie    démo 360 → 408
 *   carte 4 Paiement      démo 388 → 428
 *   sortie (vers acte 4)  430 → 452
 */

const CARD_W = 524;
const CARD_H = 250;
const GAP = 32;

const DEMO = [
  { start: 298, end: 346 },
  { start: 330, end: 376 },
  { start: 360, end: 408 },
  { start: 388, end: 428 },
];

/* ───────────── Éléments UI partagés ───────────── */

const Chip: React.FC<{ p: number; active?: boolean; children: React.ReactNode }> = ({ p, active, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 14px',
      borderRadius: 999,
      fontFamily: FONTS.inter,
      fontWeight: 600,
      fontSize: 16,
      color: active ? BRAND.goldPale : slateAlpha(0.8),
      background: active ? goldAlpha(0.12) : 'rgba(15,23,42,0.7)',
      border: `1px solid ${active ? goldAlpha(0.45) : 'rgba(226,232,240,0.1)'}`,
      opacity: p,
      transform: `translateY(${(1 - p) * 8}px) scale(${0.92 + p * 0.08})`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

/* ───────────── Démos ───────────── */

const SearchDemo: React.FC<{ f: number }> = ({ f }) => {
  const s = DEMO[0].start;
  const full = 'Dakar, Almadies';
  const typed = Math.floor(tween(f, [s, s + 18], [0, full.length], (t) => t));
  const focus = tween(f, [s - 4, s + 2], [0, 1]) * (1 - tween(f, [s + 40, s + 48], [0, 1]));
  const caret = f < s + 26 && Math.floor(f / 8) % 2 === 0;
  const chips = [0, 1, 2].map((i) => sp(f, s + 20 + i * 5, SPRINGS.snappy));
  const ok = sp(f, s + 36, SPRINGS.snappy);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          height: 52,
          borderRadius: 14,
          background: 'rgba(15,23,42,0.85)',
          border: `1px solid ${focus > 0.01 ? goldAlpha(0.2 + 0.4 * focus) : 'rgba(226,232,240,0.1)'}`,
          boxShadow: `0 0 0 ${4 * focus}px ${goldAlpha(0.1 * focus)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          fontFamily: FONTS.inter,
          fontSize: 19,
          fontWeight: 500,
          color: BRAND.darkText,
        }}
      >
        <Search size={20} color={focus > 0.3 ? BRAND.gold : slateAlpha(0.5)} strokeWidth={2.2} />
        <span style={{ color: typed === 0 ? slateAlpha(0.4) : BRAND.darkText }}>
          {typed === 0 ? 'Où cherchez-vous ?' : full.slice(0, typed)}
        </span>
        <span style={{ width: 2, height: 22, background: BRAND.gold, opacity: caret && focus > 0.5 ? 1 : 0, marginLeft: -8 }} />
        <span style={{ flex: 1 }} />
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 15,
            fontWeight: 600,
            color: BRAND.gold,
            opacity: ok,
            transform: `scale(${0.8 + ok * 0.2})`,
          }}
        >
          <CircleCheck size={17} strokeWidth={2.4} /> 128 biens
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Chip p={chips[0]} active>
          Dakar
        </Chip>
        <Chip p={chips[1]}>Max. 350 000 FCFA</Chip>
        <Chip p={chips[2]}>Appartement</Chip>
      </div>
    </div>
  );
};

const VerifiedDemo: React.FC<{ f: number }> = ({ f }) => {
  const s = DEMO[1].start;
  const check = tween(f, [s + 4, s + 18], [0, 1], EASE.inOut);
  const halo = tween(f, [s + 10, s + 22], [0, 1]) * (1 - 0.5 * tween(f, [s + 30, s + 46], [0, 1]));
  const bar = tween(f, [s, s + 30], [0, 1], EASE.inOut);
  const rows = [0, 1].map((i) => sp(f, s + 14 + i * 7, SPRINGS.snappy));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(circle at 50% 40%, ${goldAlpha(0.18 + 0.2 * halo)}, ${goldAlpha(0.03)} 70%)`,
          border: `1px solid ${goldAlpha(0.25 + 0.3 * halo)}`,
          boxShadow: `0 0 ${50 * halo}px ${goldAlpha(0.4 * halo)}`,
        }}
      >
        <ShieldCheckMark size={52} check={check} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          'Visite terrain effectuée',
          'Photos & documents conformes',
        ].map((t, i) => (
          <div
            key={t}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: FONTS.inter,
              fontSize: 17,
              fontWeight: 500,
              color: BRAND.darkText,
              opacity: rows[i],
              transform: `translateX(${(1 - rows[i]) * -10}px)`,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: goldAlpha(0.16),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={14} color={BRAND.gold} strokeWidth={3} />
            </span>
            {t}
          </div>
        ))}
        <div style={{ height: 6, borderRadius: 99, background: 'rgba(226,232,240,0.08)', overflow: 'hidden', marginTop: 4 }}>
          <div
            style={{
              width: `${bar * 100}%`,
              height: '100%',
              borderRadius: 99,
              background: `linear-gradient(90deg, ${BRAND.goldDark}, ${BRAND.gold})`,
              boxShadow: `0 0 12px ${goldAlpha(0.6)}`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const Bubble: React.FC<{ p: number; mine?: boolean; children: React.ReactNode }> = ({ p, mine, children }) => (
  <div
    style={{
      alignSelf: mine ? 'flex-end' : 'flex-start',
      maxWidth: 360,
      padding: '11px 16px',
      borderRadius: 18,
      borderBottomRightRadius: mine ? 6 : 18,
      borderBottomLeftRadius: mine ? 18 : 6,
      background: mine ? goldAlpha(0.14) : 'rgba(15,23,42,0.85)',
      border: `1px solid ${mine ? goldAlpha(0.3) : 'rgba(226,232,240,0.1)'}`,
      color: mine ? BRAND.goldPale : BRAND.darkText,
      fontFamily: FONTS.inter,
      fontWeight: 500,
      fontSize: 17,
      opacity: p,
      transform: `translateY(${(1 - p) * 12}px) scale(${0.94 + p * 0.06})`,
      transformOrigin: mine ? 'bottom right' : 'bottom left',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

const ChatDemo: React.FC<{ f: number }> = ({ f }) => {
  const s = DEMO[2].start;
  const b1 = sp(f, s, SPRINGS.snappy);
  const typing = tween(f, [s + 10, s + 14], [0, 1]) * (1 - tween(f, [s + 28, s + 31], [0, 1]));
  const b2 = sp(f, s + 30, SPRINGS.snappy);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, height: 104 }}>
      <Bubble p={b1} mine>
        L&apos;appartement est-il disponible ?
      </Bubble>
      <div style={{ position: 'relative', height: 46 }}>
        {typing > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              display: 'flex',
              gap: 6,
              padding: '16px 18px',
              borderRadius: 18,
              borderBottomLeftRadius: 6,
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(226,232,240,0.1)',
              opacity: typing,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: slateAlpha(0.6),
                  transform: `translateY(${Math.sin(f * 0.45 - i * 0.9) * 2.5}px)`,
                }}
              />
            ))}
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex' }}>
          {b2 > 0.01 && <Bubble p={b2}>Oui ! Visite possible demain à 10h.</Bubble>}
        </div>
      </div>
    </div>
  );
};

const PaymentDemo: React.FC<{ f: number }> = ({ f }) => {
  const s = DEMO[3].start;
  const methods = ['Wave', 'Orange Money', 'Carte'];
  const pills = methods.map((_, i) => sp(f, s + i * 4, SPRINGS.snappy));
  const select = tween(f, [s + 16, s + 22], [0, 1]);
  const confirm = sp(f, s + 26, SPRINGS.snappy);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {methods.map((m, i) => (
          <Chip key={m} p={pills[i]} active={i === 0 && select > 0.5}>
            {m}
          </Chip>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 14,
          background: 'rgba(15,23,42,0.85)',
          border: `1px solid ${goldAlpha(0.12 + 0.25 * confirm)}`,
          fontFamily: FONTS.inter,
          opacity: confirm,
          transform: `translateY(${(1 - confirm) * 10}px)`,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 600, color: BRAND.darkText }}>
          <CircleCheck size={20} color={BRAND.gold} strokeWidth={2.4} />
          Loyer réglé
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: BRAND.goldPale }}>350 000 FCFA</span>
      </div>
    </div>
  );
};

/* ───────────── Carte ───────────── */

const FEATURES = [
  { Icon: Search, title: 'Recherche simplifiée', sub: 'Ville · Budget · Type de bien', Demo: SearchDemo },
  { Icon: Shield, title: 'AlloVérifié™', sub: 'Vérifié sur le terrain', Demo: VerifiedDemo },
  { Icon: MessageCircle, title: 'Messagerie sécurisée', sub: 'Échangez directement', Demo: ChatDemo },
  { Icon: Wallet, title: 'Paiement sécurisé', sub: 'Wave · Orange Money · Carte', Demo: PaymentDemo },
];

const FeatureCard: React.FC<{ i: number; f: number }> = ({ i, f }) => {
  const { Icon, title, sub, Demo } = FEATURES[i];
  const inP = sp(f, AUDIO_CUES.cards[i], SPRINGS.smooth);
  const opacity = tween(f, [AUDIO_CUES.cards[i], AUDIO_CUES.cards[i] + 12], [0, 1]);
  const d = DEMO[i];
  const active = tween(f, [d.start - 6, d.start + 4], [0, 1]) * (1 - tween(f, [d.end - 4, d.end + 8], [0, 1]));
  const isVerified = i === 1;
  const sweep = tween(f, [d.start - 2, d.start + 22], [0, 1], EASE.inOut);

  return (
    <div
      style={{
        position: 'relative',
        width: CARD_W,
        height: CARD_H,
        borderRadius: SHAPE.radiusCard,
        padding: 28,
        boxSizing: 'border-box',
        background: `linear-gradient(160deg, rgba(30,41,59,0.96) 0%, rgba(30,41,59,0.86) 55%, rgba(15,23,42,0.9) 100%)`,
        border: `1px solid ${active > 0.01 ? goldAlpha(0.12 + 0.38 * active) : 'rgba(226,232,240,0.08)'}`,
        boxShadow: `${SHAPE.shadowCard}, 0 0 ${48 * active}px ${goldAlpha(0.16 * active)}`,
        opacity,
        transform: `translateY(${(1 - inP) * 50}px) scale(${0.95 + inP * 0.05 + active * 0.012})`,
        filter: `blur(${(1 - inP) * 10}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        overflow: 'hidden',
      }}
    >
      {/* Liseré lumineux supérieur */}
      <div
        style={{
          position: 'absolute',
          left: 28,
          right: 28,
          top: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${isVerified ? goldAlpha(0.5) : paleAlpha(0.18)}, transparent)`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: SHAPE.radiusTile,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(145deg, ${goldAlpha(0.2)}, ${goldAlpha(0.05)})`,
            border: `1px solid ${goldAlpha(0.28)}`,
            boxShadow: `0 0 ${24 * active}px ${goldAlpha(0.35 * active)}`,
            flexShrink: 0,
          }}
        >
          <Icon size={28} color={BRAND.gold} strokeWidth={2} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontFamily: FONTS.poppins,
              fontWeight: 600,
              fontSize: 27,
              letterSpacing: -0.4,
              color: BRAND.surface,
              lineHeight: 1.15,
            }}
          >
            {isVerified ? <GoldText>{title}</GoldText> : title}
          </div>
          <div style={{ fontFamily: FONTS.inter, fontWeight: 500, fontSize: 18, color: slateAlpha(0.6) }}>
            {sub}
          </div>
        </div>
        {i === 2 && (
          <Lock size={18} color={slateAlpha(0.4)} strokeWidth={2} style={{ marginLeft: 'auto', alignSelf: 'flex-start' }} />
        )}
      </div>
      <Demo f={f} />
      <LightSweep progress={sweep} radius={SHAPE.radiusCard} intensity={0.08} width="40%" />
    </div>
  );
};

/* ───────────── Scène ───────────── */

export const Act3Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { layout } = useFormat();
  if (frame < 262 || frame > 454) return null;
  const L = layout.act3;

  const title = sp(frame, 270, SPRINGS.smooth);
  const titleO = tween(frame, [270, 284], [0, 1]);
  const exit = tween(frame, [430, 452], [0, 1], EASE.in);
  const cols = L.columns;

  return (
    <AbsoluteFill>
      <CenterAt y={L.title}>
        <div
          style={{
            fontFamily: FONTS.poppins,
            fontWeight: 600,
            fontSize: 54,
            letterSpacing: -1.2,
            color: BRAND.surface,
            whiteSpace: 'nowrap',
            opacity: titleO * (1 - tween(frame, [428, 444], [0, 1], EASE.in)),
            transform: `translateY(${(1 - title) * 24 - exit * 30}px)`,
            filter: `blur(${(1 - title) * 8 + exit * 10}px)`,
          }}
        >
          Tout ce qu&apos;il vous faut, <GoldText>en un seul endroit.</GoldText>
        </div>
      </CenterAt>

      <CenterAt y={L.grid}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${CARD_W}px)`,
            gap: GAP,
            // Sortie : les cartes se resserrent vers le centre et s'effacent.
            opacity: 1 - exit,
            transform: `scale(${1 - exit * 0.16}) translateY(${wobble(frame, 4, 2)}px)`,
            filter: `blur(${exit * 12}px)`,
          }}
        >
          {FEATURES.map((_, i) => (
            <FeatureCard key={i} i={i} f={frame} />
          ))}
        </div>
      </CenterAt>
    </AbsoluteFill>
  );
};
