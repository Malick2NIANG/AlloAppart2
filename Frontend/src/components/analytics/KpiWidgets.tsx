'use client';

/**
 * Composants "cockpit" utilisés par la Vue d'ensemble admin
 * (espace/page.tsx, via OverviewAnalytics.tsx) : lectures numériques
 * glowing, jauges radiales, barres de répartition, donuts de statut.
 * Extraits ici pour garder le composant de page lisible. Couleurs fixes
 * (accents néon) volontaires — seul le fond/texte suit le thème clair/sombre
 * via les classes bg-card/border-line/text-text/text-sub déjà partagées par
 * tout le dashboard admin.
 */

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';

export const NEON = {
  gold:    '#b8972a',
  cyan:    '#0891b2',
  purple:  '#a855f7',
  emerald: '#10b981',
  blue:    '#3b82f6',
  red:     '#ef4444',
  amber:   '#f59e0b',
};

// Couleurs lues depuis les variables CSS du thème (--aa-*, cf. globals.css)
// pour que les graphes recharts (qui n'acceptent que des couleurs CSS, pas
// des classes Tailwind) suivent le thème clair/sombre comme le reste de la
// page au lieu d'être figés sur un rendu.
export const THEME = {
  line: 'var(--aa-line)',
  sub:  'var(--aa-sub)',
  card: 'var(--aa-card)',
  text: 'var(--aa-text)',
};

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-sub">
      <span className="h-px w-4 bg-gold-dark/40" />
      {children}
    </h2>
  );
}

export function ReadoutCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="col-span-1 rounded-2xl border border-line bg-card p-5 flex flex-col justify-between min-h-[150px]">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}1a` }}>
        <i className={`fa-solid ${icon} text-sm`} style={{ color }} />
      </div>
      <div>
        <p className="font-mono text-2xl font-extrabold text-text tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-xs text-sub">{label}</p>
      </div>
    </div>
  );
}

export function MiniReadout({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}1a` }}>
        <i className={`fa-solid ${icon} text-sm`} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-lg font-bold text-text tabular-nums truncate">{value}</p>
        <p className="text-[11px] text-sub truncate">{label}</p>
      </div>
    </div>
  );
}

export function GaugeCard({
  icon, color, label, sub, value, max, centerText,
}: {
  icon: string; color: string; label: string; sub: string; value: number; max: number; centerText: string;
}) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="col-span-1 rounded-2xl border border-line bg-card p-4 flex flex-col items-center text-center gap-2 min-h-[150px] justify-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--aa-line)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <i className={`fa-solid ${icon} text-xs`} style={{ color }} />
      </div>
      <p className="font-mono text-sm font-bold text-text tabular-nums">{centerText}</p>
      <div>
        <p className="text-xs font-medium text-text">{label}</p>
        <p className="text-[10px] text-sub">{sub}</p>
      </div>
    </div>
  );
}

export function RoleBar({ icon, color, label, value, total }: { icon: string; color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}1a` }}>
        <i className={`fa-solid ${icon} text-xs`} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-sub truncate">{label}</span>
          <span className="font-mono text-sm font-bold text-text shrink-0 ml-2">{value}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

export function StatusDonut({
  title, icon, total, items,
}: {
  title: string; icon: string; total: number;
  items: { key: string; label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
        <i className={`fa-solid ${icon} text-xs text-sub`} />
        {title}
      </p>
      <div className="flex items-center gap-6">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items} dataKey="value" nameKey="label"
                innerRadius={42} outerRadius={62} paddingAngle={3} strokeWidth={0}
              >
                {items.map((it) => (
                  <Cell key={it.key} fill={it.value > 0 ? it.color : 'var(--aa-line)'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--aa-card)', border: '1px solid var(--aa-line)', borderRadius: 12, fontSize: 12, color: 'var(--aa-text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-mono text-xl font-extrabold text-text">{total}</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-sub">
                <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
                {it.label}
              </span>
              <span className="font-mono font-bold text-text">{it.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
