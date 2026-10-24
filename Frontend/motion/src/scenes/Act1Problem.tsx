import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import {
  CalendarX2,
  CircleHelp,
  CircleCheck,
  CircleX,
  ImageOff,
  PhoneOff,
  TriangleAlert,
} from 'lucide-react';
import { BRAND, DANGER, FONTS, SHAPE, slateAlpha } from '../config/brand';
import { AUDIO_CUES } from '../config/timeline';
import { CenterAt, useFormat } from '../lib/format';
import { EASE, glitchAt, rand, tween, wobble } from '../lib/anim';

/**
 * ACTE 1 — LE PROBLÈME (frames 0 → 120)
 * Froid, instable, anxiogène. AUCUN DORÉ.
 * Les éléments se dissolvent de gauche à droite quand la lumière dorée
 * de la transition les traverse (frames ~100 → 128).
 */

const GLITCH_HITS = [27, 53, 62, 81, 95];

/** Dissolution synchronisée avec le balayage lumineux (gauche → droite). */
const dissolve = (frame: number, xFrac: number) => {
  const start = 100 + xFrac * 18;
  const p = tween(frame, [start, start + 14], [0, 1], EASE.in);
  return { opacity: 1 - p, blur: p * 14, scale: 1 + p * 0.06 };
};

/* ───────────────────────── Cartes "problème" ───────────────────────── */

type Floating = {
  id: string;
  xFrac: number;
  yFrac: number;
  rot: number;
  depth: number; // 1 = premier plan, <1 = arrière-plan (plus petit, plus flou)
  enter: number;
  shifts?: Array<{ at: number; dx: number; dy: number }>;
  children: React.ReactNode;
};

const FloatingCard: React.FC<Floating> = ({ id, xFrac, yFrac, rot, depth, enter, shifts = [], children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useFormat();
  const inP = tween(frame, [enter, enter + 20], [0, 1], EASE.out);
  const d = dissolve(frame, xFrac);
  const g = glitchAt(frame, GLITCH_HITS, 3) * (rand(`g${id}${Math.floor(frame / 3)}`) > 0.4 ? 1 : 0);

  // Cartes qui "se décalent" : petits sauts d'alignement.
  let sx = 0;
  let sy = 0;
  for (const s of shifts) {
    const k = tween(frame, [s.at, s.at + 6], [0, 1], EASE.out);
    sx += s.dx * k;
    sy += s.dy * k;
  }

  const x = xFrac * width + wobble(frame, xFrac * 10, 5) + sx + g * (rand(`gx${id}${frame}`) - 0.5) * 16;
  const y = yFrac * height + wobble(frame, yFrac * 10 + 3, 4) + sy + (1 - inP) * 18;
  const r = rot + wobble(frame, xFrac * 7, 0.5);
  const s = (0.94 + inP * 0.06) * depth * d.scale;
  const blur = (1 - depth) * 5 + d.blur + (1 - inP) * 6;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${r}deg) scale(${s})`,
        opacity: inP * d.opacity * (0.55 + depth * 0.45),
        filter: `blur(${blur}px)`,
      }}
    >
      {/* Fantôme rouge du glitch */}
      {g > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateX(${g * 7}px)`,
            opacity: 0.35 * g,
            mixBlendMode: 'screen',
            filter: 'sepia(1) saturate(6) hue-rotate(-50deg)',
          }}
        >
          {children}
        </div>
      )}
      {children}
    </div>
  );
};

const cardBase: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92))',
  border: SHAPE.borderStrong,
  borderRadius: 22,
  boxShadow: '0 30px 60px -25px rgba(0,0,0,0.8)',
  fontFamily: FONTS.inter,
  color: BRAND.darkText,
  overflow: 'hidden',
};

const Hatch: React.FC<{ h: number }> = ({ h }) => (
  <div
    style={{
      height: h,
      background:
        'repeating-linear-gradient(135deg, rgba(100,116,139,0.16) 0 10px, rgba(100,116,139,0.07) 10px 20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: SHAPE.border,
    }}
  >
    <ImageOff size={40} color={DANGER.grey} strokeWidth={1.6} />
  </div>
);

const Tag: React.FC<{ color: string; bg: string; children: React.ReactNode }> = ({ color, bg, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 999,
      background: bg,
      color,
      fontSize: 15,
      fontWeight: 600,
    }}
  >
    {children}
  </span>
);

const ListingCard: React.FC<{
  title: string;
  price: React.ReactNode;
  tag: React.ReactNode;
}> = ({ title, price, tag }) => (
  <div style={{ ...cardBase, width: 330 }}>
    <Hatch h={150} />
    <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 19, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: slateAlpha(0.7) }}>{price}</div>
      <div>{tag}</div>
    </div>
  </div>
);

const Toast: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub: string;
  time: string;
  width?: number;
}> = ({ icon, iconBg, title, sub, time, width = 400 }) => (
  <div style={{ ...cardBase, width, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 14,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 13, color: DANGER.grey }}>{time}</span>
      </div>
      <div style={{ fontSize: 15, color: slateAlpha(0.62), marginTop: 3 }}>{sub}</div>
    </div>
  </div>
);

/** Notification contradictoire : "confirmée" puis "annulée" (glitch à 62). */
const ContradictoryToast: React.FC = () => {
  const frame = useCurrentFrame();
  const flipped = frame >= 62;
  const flash = flipped ? tween(frame, [62, 76], [1, 0]) : 0;
  return (
    <div style={{ position: 'relative' }}>
      {flipped ? (
        <Toast
          icon={<CircleX size={24} color={DANGER.red} strokeWidth={2.2} />}
          iconBg={DANGER.redSoft}
          title="Visite annulée"
          sub="Le propriétaire ne répond plus."
          time="à l'instant"
        />
      ) : (
        <Toast
          icon={<CircleCheck size={24} color={slateAlpha(0.7)} strokeWidth={2} />}
          iconBg="rgba(148,163,184,0.14)"
          title="Visite confirmée"
          sub="Rendez-vous demain à 10h."
          time="il y a 2 h"
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          boxShadow: `0 0 0 2px rgba(239,68,68,${0.8 * flash}), 0 0 40px rgba(239,68,68,${0.35 * flash})`,
        }}
      />
    </div>
  );
};

/* ───────────────────────── Symboles & lignes ───────────────────────── */

const SYMBOLS: Array<{ x: number; y: number; kind: '?' | 'x' | '!'; size: number; seed: number }> = [
  { x: 0.29, y: 0.14, kind: '?', size: 54, seed: 1 },
  { x: 0.7, y: 0.1, kind: 'x', size: 30, seed: 2 },
  { x: 0.06, y: 0.5, kind: '?', size: 72, seed: 3 },
  { x: 0.95, y: 0.37, kind: '!', size: 26, seed: 4 },
  { x: 0.3, y: 0.9, kind: 'x', size: 26, seed: 5 },
  { x: 0.68, y: 0.9, kind: '?', size: 46, seed: 6 },
  { x: 0.94, y: 0.9, kind: 'x', size: 22, seed: 7 },
  { x: 0.24, y: 0.62, kind: '!', size: 22, seed: 8 },
  { x: 0.76, y: 0.28, kind: '?', size: 34, seed: 9 },
];

const Symbols: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useFormat();
  return (
    <>
      {SYMBOLS.map((s) => {
        // Apparitions / disparitions irrégulières.
        const period = 34 + s.seed * 5;
        const local = (frame + s.seed * 13) % period;
        const blink = tween(local, [0, 8], [0, 1]) * (1 - tween(local, [period - 10, period], [0, 1]));
        const enter = tween(frame, [4 + s.seed * 2, 20 + s.seed * 2], [0, 1]);
        const d = dissolve(frame, s.x);
        const color = s.kind === '?' ? slateAlpha(0.35) : s.kind === 'x' ? DANGER.red : DANGER.orange;
        return (
          <div
            key={s.seed}
            style={{
              position: 'absolute',
              left: s.x * width + wobble(frame, s.seed, 6),
              top: s.y * height + wobble(frame, s.seed + 5, 6) - frame * 0.08,
              transform: 'translate(-50%, -50%)',
              fontFamily: FONTS.poppins,
              fontWeight: 700,
              fontSize: s.size,
              lineHeight: 1,
              color,
              opacity: blink * enter * d.opacity * (s.kind === '?' ? 0.9 : 0.55),
              filter: `blur(${d.blur + (s.size > 50 ? 1.5 : 0)}px)`,
            }}
          >
            {s.kind === 'x' ? '×' : s.kind}
          </div>
        );
      })}
    </>
  );
};

/** Lignes qui se croisent : connexions rompues entre les annonces. */
const BrokenLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useFormat();
  const lines = [
    { x1: 0.12, y1: 0.26, x2: 0.86, y2: 0.72, d: 6 },
    { x1: 0.84, y1: 0.2, x2: 0.14, y2: 0.78, d: 12 },
    { x1: 0.02, y1: 0.42, x2: 0.98, y2: 0.58, d: 18 },
  ];
  const fade = 1 - tween(frame, [98, 116], [0, 1]);
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        opacity: fade,
        // Les lignes s'effacent derrière le texte central (lisibilité).
        maskImage: 'radial-gradient(ellipse 32% 34% at 50% 50%, transparent 40%, black 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 32% 34% at 50% 50%, transparent 40%, black 100%)',
      }}
    >
      {lines.map((l, i) => {
        const len = Math.hypot((l.x2 - l.x1) * width, (l.y2 - l.y1) * height);
        const p = tween(frame, [l.d, l.d + 40], [0, 1], EASE.inOut);
        const flicker = glitchAt(frame, GLITCH_HITS, 2) > 0 ? 0.4 : 1;
        return (
          <line
            key={i}
            x1={l.x1 * width}
            y1={l.y1 * height}
            x2={l.x2 * width}
            y2={l.y2 * height}
            stroke={i === 1 ? 'rgba(239,68,68,0.22)' : DANGER.greyLine}
            strokeWidth={1.2}
            strokeDasharray={`${len * p} ${len}`}
            opacity={flicker}
          />
        );
      })}
    </svg>
  );
};

/* ───────────────────────── Texte principal ───────────────────────── */

const HEADLINE = [
  ['Trouver', 'un', 'logement', 'fiable'],
  ['au', 'Sénégal ?'],
];

const Headline: React.FC = () => {
  const frame = useCurrentFrame();
  const g = glitchAt(frame, [53, 95], 3);
  const exit = tween(frame, [102, 118], [0, 1], EASE.in);
  let i = 0;
  return (
    <div
      style={{
        fontFamily: FONTS.poppins,
        fontWeight: 700,
        fontSize: 80,
        lineHeight: 1.08,
        letterSpacing: -1.8,
        color: BRAND.surface,
        textAlign: 'center',
        transform: `translate(${wobble(frame, 2, 1.2) + g * 4}px, ${wobble(frame, 9, 0.8)}px) scale(${1 + exit * 0.04})`,
        textShadow: g > 0 ? `${-3 * g}px 0 rgba(239,68,68,0.7), ${3 * g}px 0 rgba(226,232,240,0.5)` : undefined,
        opacity: 1 - exit,
        filter: `blur(${exit * 16}px)`,
      }}
    >
      {HEADLINE.map((line, li) => (
        <div key={li} style={{ display: 'flex', justifyContent: 'center', gap: '0.26em' }}>
          {line.map((word) => {
            const start = 4 + i++ * 4;
            const p = tween(frame, [start, start + 18], [0, 1]);
            return (
              <span
                key={word}
                style={{
                  display: 'inline-block',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 30}px)`,
                  filter: `blur(${(1 - p) * 12}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const PROBLEMS = [
  { label: 'Annonces douteuses.', Icon: CircleHelp, color: DANGER.orange, bg: DANGER.orangeSoft },
  { label: 'Visites annulées.', Icon: CalendarX2, color: DANGER.red, bg: DANGER.redSoft },
  { label: 'Arnaques au loyer.', Icon: TriangleAlert, color: DANGER.red, bg: DANGER.redSoft },
];

const ProblemLines: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      {PROBLEMS.map(({ label, Icon, color, bg }, idx) => {
        const start = AUDIO_CUES.problemHits[idx];
        const p = tween(frame, [start, start + 14], [0, 1]);
        // Micro-shake contrôlé à l'arrivée, amorti.
        const shakeK = tween(frame, [start + 2, start + 12], [1, 0]);
        const shake = Math.sin((frame - start) * 2.6) * 5 * shakeK * (p > 0 ? 1 : 0);
        const exitStart = 98 + idx * 2;
        const ex = tween(frame, [exitStart, exitStart + 14], [0, 1], EASE.in);
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              opacity: p * (1 - ex),
              transform: `translateX(${(1 - p) * -24 + shake}px)`,
              filter: `blur(${(1 - p) * 8 + ex * 12}px)`,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: bg,
                border: `1px solid ${color}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={26} color={color} strokeWidth={2.2} />
            </div>
            <span
              style={{
                fontFamily: FONTS.inter,
                fontWeight: 600,
                fontSize: 38,
                letterSpacing: -0.4,
                color: BRAND.darkText,
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ───────────────────────── Scène ───────────────────────── */

export const Act1Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { layout } = useFormat();
  if (frame > 132) return null;

  // Lent travelling avant (push-in) : la tension monte.
  const push = 1 + tween(frame, [0, 118], [0, 0.035], EASE.inOut);

  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <BrokenLines />
      <Symbols />

      <FloatingCard id="a" xFrac={0.12} yFrac={0.27} rot={-7} depth={0.92} enter={2} shifts={[{ at: 50, dx: 16, dy: -6 }]}>
        <ListingCard
          title="Appartement F3 · Almadies"
          price="??? FCFA / mois"
          tag={
            <Tag color={DANGER.red} bg={DANGER.redSoft}>
              <TriangleAlert size={14} strokeWidth={2.4} /> Annonce signalée
            </Tag>
          }
        />
      </FloatingCard>

      <FloatingCard id="b" xFrac={0.85} yFrac={0.19} rot={4} depth={1} enter={8}>
        <ContradictoryToast />
      </FloatingCard>

      <FloatingCard id="c" xFrac={0.14} yFrac={0.8} rot={3} depth={0.96} enter={14} shifts={[{ at: 78, dx: -10, dy: 8 }]}>
        <Toast
          icon={<TriangleAlert size={24} color={DANGER.orange} strokeWidth={2.2} />}
          iconBg={DANGER.orangeSoft}
          title="Avance exigée"
          sub="Payez 3 mois avant toute visite."
          time="il y a 5 min"
        />
      </FloatingCard>

      <FloatingCard id="d" xFrac={0.87} yFrac={0.73} rot={-5} depth={0.9} enter={20} shifts={[{ at: 36, dx: -14, dy: 0 }]}>
        <ListingCard
          title="Villa · Mermoz"
          price={
            <span>
              <span style={{ textDecoration: 'line-through', color: DANGER.grey }}>250 000</span>{' '}
              <span style={{ color: DANGER.orange }}>480 000 FCFA ?</span>
            </span>
          }
          tag={
            <Tag color={slateAlpha(0.75)} bg="rgba(148,163,184,0.14)">
              Infos contradictoires
            </Tag>
          }
        />
      </FloatingCard>

      <FloatingCard id="e" xFrac={0.86} yFrac={0.46} rot={2} depth={0.74} enter={26}>
        <Toast
          icon={<PhoneOff size={22} color={DANGER.red} strokeWidth={2.2} />}
          iconBg={DANGER.redSoft}
          title="Numéro injoignable"
          sub="Annonce retirée sans préavis."
          time="hier"
          width={360}
        />
      </FloatingCard>

      <CenterAt y={layout.act1.headline}>
        <Headline />
      </CenterAt>
      <CenterAt y={layout.act1.lines}>
        <ProblemLines />
      </CenterAt>
    </AbsoluteFill>
  );
};
