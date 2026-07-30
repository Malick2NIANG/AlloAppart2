'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

const ROLES: { key: DemoRole; icon: string }[] = [
  { key: 'visitor',   icon: 'fa-solid fa-eye'           },
  { key: 'locataire', icon: 'fa-solid fa-key'           },
  { key: 'bailleur',  icon: 'fa-solid fa-house-chimney' },
  { key: 'dual',      icon: 'fa-solid fa-shuffle'       },
  { key: 'admin',     icon: 'fa-solid fa-shield-halved' },
  { key: 'agent',     icon: 'fa-solid fa-id-badge'      },
];

export default function DemoDevBar() {
  const t = useTranslations('demo');
  const [role,      setRole]      = useState<DemoRole>('visitor');
  const [mounted,   setMounted]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aa_demo_role') as DemoRole | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration on mount
    if (stored && ['visitor', 'locataire', 'bailleur', 'dual', 'admin', 'agent'].includes(stored)) setRole(stored);
    setMounted(true);
  }, []);

  const apply = (r: DemoRole) => {
    setRole(r);
    localStorage.setItem('aa_demo_role', r);
    window.dispatchEvent(new CustomEvent('aa-demo-change', { detail: r }));
  };

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999]">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-full border border-gold/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl px-4 py-2 text-xs font-bold text-gold-dark"
        >
          <i className="fa-solid fa-flask text-[11px]" /> {t('badge')}
        </button>
      ) : (
        <div className="flex items-center gap-1 rounded-full border border-gold/40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl px-2 py-1.5">
          <span className="text-[10px] font-bold text-sub tracking-widest uppercase ml-1 mr-1.5">
            <i className="fa-solid fa-flask mr-1 text-gold-dark" />{t('label')}
          </span>
          <div className="h-3.5 w-px bg-line" />
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => apply(r.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                role === r.key
                  ? 'bg-gold text-gray-900 shadow-sm'
                  : 'text-sub hover:text-text hover:bg-card'
              }`}
            >
              <i className={`${r.icon} text-[10px]`} />
              {t(r.key as Parameters<typeof t>[0])}
            </button>
          ))}
          <div className="h-3.5 w-px bg-line" />
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-sub hover:bg-card transition"
          >
            <i className="fa-solid fa-minus text-[9px]" />
          </button>
        </div>
      )}
    </div>
  );
}
