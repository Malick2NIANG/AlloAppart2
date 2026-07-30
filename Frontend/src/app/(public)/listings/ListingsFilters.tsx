'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

const TYPES = [
  { key: '',            icon: 'fa-list',       tKey: 'filterAll'     },
  { key: 'APPARTEMENT', icon: 'fa-building',   tKey: 'filterApts'    },
  { key: 'STUDIO',      icon: 'fa-bed',        tKey: 'filterStudios' },
  { key: 'VILLA',       icon: 'fa-house-user', tKey: 'filterVillas'  },
  { key: 'BUREAU',      icon: 'fa-briefcase',  tKey: 'filterOffices' },
  { key: 'CHAMBRE',     icon: 'fa-door-open',  tKey: 'filterRooms'   },
];

const REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor',
  'Diourbel', 'Louga', 'Fatick', 'Kolda',
  'Tambacounda', 'Kaolack', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou',
];

const PER_PAGE_OPTIONS = [6, 12, 24];

const OWNER_TYPES = [
  { key: '',            icon: 'fa-border-all', tKey: 'ownerAll'         },
  { key: 'PARTICULIER', icon: 'fa-user',       tKey: 'ownerIndividuals' },
  { key: 'AGENCE',      icon: 'fa-building',   tKey: 'ownerAgencies'    },
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

export default function ListingsFilters({ type, region, q, city, minPrice, maxPrice, ownerType, limit, locale: _locale }: Props) {
  const t = useTranslations('listings');
  const router = useRouter();
  const urlParams = useSearchParams();
  const [regionOpen, setRegionOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  const isVerifiedOnly = urlParams.get('verified') === 'true';
  const verified = isVerifiedOnly ? 'true' : undefined;

  const hasFilters = !!(type || region || q || city || minPrice || maxPrice || ownerType || isVerifiedOnly);
  const activeType = type ?? '';
  const activeOwnerType = ownerType ?? '';

  const push = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, city, minPrice, maxPrice, type, region, ownerType, verified, limit: String(limit), page: '1', ...overrides };
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

      {/* ── Ligne 0 : Tous / Particuliers / Agences / AlloVérifié ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {OWNER_TYPES.map((ot) => {
          const isActive = activeOwnerType === ot.key;
          return (
            <button
              key={ot.key}
              onClick={() => push({ ownerType: ot.key || undefined, page: '1' })}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border-gold bg-gold text-gray-900 shadow-sm scale-[1.02]'
                  : 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark'
              }`}
            >
              <i className={`fa-solid ${ot.icon} text-xs ${isActive ? 'text-gray-900' : 'text-gold-dark'}`} />
              {t(ot.tKey)}
            </button>
          );
        })}

        {/* Séparateur visuel */}
        <span className="h-5 w-px bg-gold mx-1 shrink-0" />

        {/* Toggle AlloVérifié */}
        <button
          onClick={() => push({ verified: isVerifiedOnly ? undefined : 'true', page: '1' })}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
            isVerifiedOnly
              ? 'border-gold bg-gold text-gray-900 shadow-sm scale-[1.02]'
              : 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark'
          }`}
        >
          <i className={`fa-solid fa-shield-halved text-xs ${isVerifiedOnly ? 'text-gray-900' : 'text-gold-dark'}`} />
          AlloVérifié
        </button>
      </div>

      {/* ── Ligne 1 : chips de type ───────────────────────────── */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {TYPES.map((typ) => {
          const isActive = activeType === typ.key;
          return (
            <button
              key={typ.key}
              onClick={() => push({ type: typ.key || undefined, page: '1' })}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border-gold bg-gold text-gray-900 shadow-sm scale-[1.02]'
                  : 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark'
              }`}
            >
              <i className={`fa-solid ${typ.icon} text-xs ${isActive ? 'text-gray-900' : 'text-gold-dark'}`} />
              {t(typ.tKey)}
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
            {region ?? t('regionAll')}
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
                {t('regionAll')}
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
            {t('clearFilters')}
          </button>
        )}

        <div className="flex-1" />

        {/* Par page */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-sub hidden sm:inline">{t('perPage')}</span>
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
