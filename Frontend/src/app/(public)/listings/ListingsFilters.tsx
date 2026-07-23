'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const TYPES = [
  { key: '',            icon: 'fa-list',         fr: 'Tous',      en: 'All'        },
  { key: 'APPARTEMENT', icon: 'fa-building',     fr: 'Apparts',   en: 'Apts'       },
  { key: 'STUDIO',      icon: 'fa-bed',          fr: 'Studios',   en: 'Studios'    },
  { key: 'VILLA',       icon: 'fa-house-user',   fr: 'Villas',    en: 'Villas'     },
  { key: 'BUREAU',      icon: 'fa-briefcase',    fr: 'Bureaux',   en: 'Offices'    },
  { key: 'CHAMBRE',     icon: 'fa-door-open',    fr: 'Chambres',  en: 'Rooms'      },
];

const REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor',
  'Diourbel', 'Louga', 'Fatick', 'Kolda',
  'Tambacounda', 'Kaolack', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou',
];

const PER_PAGE_OPTIONS = [6, 12, 24];

const OWNER_TYPES = [
  { key: '',            icon: 'fa-border-all',  fr: 'Tous',         en: 'All'         },
  { key: 'PARTICULIER', icon: 'fa-user',        fr: 'Particuliers', en: 'Individuals' },
  { key: 'AGENCE',      icon: 'fa-building',    fr: 'Agences',      en: 'Agencies'    },
] as const;

interface Props {
  type?:      string;
  region?:    string;
  q?:         string;
  city?:      string;
  minPrice?:  string;
  maxPrice?:  string;
  ownerType?: string;
  limit:      number;
  locale:     string;
}

export default function ListingsFilters({ type, region, q, city, minPrice, maxPrice, ownerType, limit, locale }: Props) {
  const router = useRouter();
  const fr = locale !== 'en';
  const [regionOpen, setRegionOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  const hasFilters = !!(type || region || q || city || minPrice || maxPrice || ownerType);
  const activeType = type ?? '';
  const activeOwnerType = ownerType ?? '';

  const push = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, city, minPrice, maxPrice, type, region, ownerType, limit: String(limit), page: '1', ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    router.push(`/listings?${params.toString()}`);
  };

  /* Close region dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (regionRef.current && !regionRef.current.contains(e.target as Node))
        setRegionOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="mb-8 space-y-3">

      {/* ── Ligne 0 : filtre Particuliers / Agences ──────────── */}
      <div className="flex gap-2 items-center">
        {OWNER_TYPES.map((ot) => {
          const isActive = activeOwnerType === ot.key;
          return (
            <button
              key={ot.key}
              onClick={() => push({ ownerType: ot.key || undefined, page: '1' })}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'border-gold-dark bg-gold-dark text-white shadow-sm'
                  : 'border-line bg-card text-text hover:border-gold-dark/50 hover:bg-gold-pale hover:text-gold-dark'
              }`}
            >
              <i className={`fa-solid ${ot.icon} text-xs ${isActive ? 'text-white' : 'text-gold-dark'}`} />
              {fr ? ot.fr : ot.en}
            </button>
          );
        })}
        {activeOwnerType === 'AGENCE' && (
          <span className="text-xs text-sub ml-1">
            — Annonces d&apos;agences immobilières
          </span>
        )}
        {activeOwnerType === 'PARTICULIER' && (
          <span className="text-xs text-sub ml-1">
            — Annonces de propriétaires
          </span>
        )}
      </div>

      {/* ── Ligne 1 : chips de type ───────────────────────────── */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {TYPES.map((t) => {
          const isActive = activeType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => push({ type: t.key || undefined, page: '1' })}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border-gold bg-gold text-gray-900 shadow-sm scale-[1.02]'
                  : 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark'
              }`}
            >
              <i className={`fa-solid ${t.icon} text-xs ${isActive ? 'text-gray-900' : 'text-gold-dark'}`} />
              {fr ? t.fr : t.en}
            </button>
          );
        })}
      </div>

      {/* ── Ligne 2 : région + reset + par page ──────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Dropdown Région personnalisé */}
        <div className="relative" ref={regionRef}>
          <button
            onClick={() => setRegionOpen((o) => !o)}
            className={`flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
              region
                ? 'border-gold/70 bg-gold-pale text-gold-dark'
                : 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark'
            }`}
          >
            <i className="fa-solid fa-map-pin text-gold-dark text-xs" />
            {region ?? (fr ? 'Toutes les régions' : 'All regions')}
            <i className={`fa-solid fa-chevron-down text-[10px] text-sub transition-transform duration-200 ${regionOpen ? 'rotate-180' : ''}`} />
          </button>

          {regionOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-card border border-line rounded-2xl shadow-xl p-3 z-40">
              {/* Toutes */}
              <button
                onClick={() => { push({ region: undefined, page: '1' }); setRegionOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition mb-1 ${
                  !region ? 'bg-gold-pale text-gold-dark' : 'text-text hover:bg-gold-pale hover:text-gold-dark'
                }`}
              >
                <i className="fa-solid fa-globe text-gold-dark text-xs w-4" />
                {fr ? 'Toutes les régions' : 'All regions'}
              </button>

              <div className="border-t border-line my-2" />

              {/* 14 régions — 2 colonnes */}
              <div className="grid grid-cols-2 gap-0.5">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { push({ region: r, page: '1' }); setRegionOpen(false); }}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm transition ${
                      region === r
                        ? 'bg-gold-pale text-gold-dark font-semibold'
                        : 'text-text hover:bg-gold-pale hover:text-gold-dark'
                    }`}
                  >
                    <i className="fa-solid fa-map-pin text-gold-dark text-[10px] shrink-0" />
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Réinitialiser */}
        {hasFilters && (
          <button
            onClick={() => router.push('/listings')}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm text-sub hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <i className="fa-solid fa-xmark text-xs" />
            {fr ? 'Effacer' : 'Clear'}
          </button>
        )}

        <div className="flex-1" />

        {/* Par page */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-sub hidden sm:inline">{fr ? 'Par page' : 'Per page'}</span>
          <div className="flex items-center gap-1 rounded-full border border-line bg-card p-1">
            {PER_PAGE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => push({ limit: String(n), page: '1' })}
                className={`flex h-7 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                  limit === n
                    ? 'bg-gold text-gray-900 shadow-sm'
                    : 'text-sub hover:text-gold-dark'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
