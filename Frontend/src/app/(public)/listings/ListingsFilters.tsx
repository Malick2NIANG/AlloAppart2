'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// Ordre + icônes alignés sur le formulaire de publication (source de vérité,
// cf. (public)/publier/page.tsx TYPE_ICONS) — ne pas diverger d'un fichier à
// l'autre, cf. décision produit du 2026-09-11.
const TYPES = [
  { key: '',            icon: 'fa-list',          tKey: 'filterAll'     },
  { key: 'APPARTEMENT', icon: 'fa-building',      tKey: 'filterApts'    },
  { key: 'VILLA',       icon: 'fa-house-chimney', tKey: 'filterVillas'  },
  { key: 'STUDIO',      icon: 'fa-door-open',     tKey: 'filterStudios' },
  { key: 'CHAMBRE',     icon: 'fa-bed',           tKey: 'filterRooms'   },
  { key: 'BUREAU',      icon: 'fa-briefcase',     tKey: 'filterOffices' },
  // Types réservés à la vente directe (agences abonnées).
  { key: 'TERRAIN',          icon: 'fa-map',          tKey: 'filterLand'       },
  { key: 'MAISON',           icon: 'fa-house',        tKey: 'filterHouses'     },
  { key: 'LOCAL_COMMERCIAL', icon: 'fa-store',        tKey: 'filterCommercial' },
];

const LOCATION_ONLY_KEYS = ['STUDIO', 'CHAMBRE', 'BUREAU'];
const VENTE_ONLY_KEYS = ['TERRAIN', 'MAISON', 'LOCAL_COMMERCIAL'];

const REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor',
  'Diourbel', 'Louga', 'Fatick', 'Kolda',
  'Tambacounda', 'Kaolack', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou',
];

const OWNER_TYPES = [
  { key: '',            icon: 'fa-border-all', tKey: 'ownerAll'         },
  { key: 'PARTICULIER', icon: 'fa-user',       tKey: 'ownerIndividuals' },
  { key: 'AGENCE',      icon: 'fa-building',   tKey: 'ownerAgencies'    },
] as const;

const TRANSACTIONS = [
  { key: '',         tKey: 'transactionAll'      },
  { key: 'LOCATION', tKey: 'transactionLocation' },
  { key: 'VENTE',    tKey: 'transactionVente'    },
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

const CHIP_BASE = 'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200';
const CHIP_ON   = 'border-gold bg-gold text-gray-900 shadow-sm';
const CHIP_OFF  = 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark';

export default function ListingsFilters({ type, region, q, city, minPrice, maxPrice, ownerType, limit, locale: _locale }: Props) {
  const t = useTranslations('listings');
  const router = useRouter();
  const urlParams = useSearchParams();
  const [regionOpen, setRegionOpen] = useState(false);
  const [panelOpen, setPanelOpen]   = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const isVerifiedOnly = urlParams.get('verified') === 'true';
  const verified = isVerifiedOnly ? 'true' : undefined;

  const rawTransaction = urlParams.get('transactionType');
  const transactionType = rawTransaction === 'LOCATION' || rawTransaction === 'VENTE' ? rawTransaction : undefined;

  const activeType = type ?? '';
  const activeOwnerType = ownerType ?? '';

  // Filtres rangés dans le panneau « Filtres » (annonceur + AlloVérifié).
  const panelCount = (ownerType ? 1 : 0) + (isVerifiedOnly ? 1 : 0);
  const hasPrice = !!(minPrice || maxPrice);
  const hasFilters = !!(type || region || q || city || hasPrice || ownerType || isVerifiedOnly || transactionType);

  // Les types spécifiques à l'autre mode n'ont pas de sens : on les masque.
  const visibleTypes = TYPES.filter((ty) => {
    if (transactionType === 'VENTE') return !LOCATION_ONLY_KEYS.includes(ty.key);
    if (transactionType === 'LOCATION') return !VENTE_ONLY_KEYS.includes(ty.key);
    return true;
  });

  const push = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, city, minPrice, maxPrice, type, region, ownerType, verified, transactionType, limit: String(limit), page: '1', ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    router.push(`/listings?${params.toString()}`);
  };

  // Changer de transaction : on abandonne le type de bien devenu incohérent
  // (ex. « Chambres » quand on passe à « À vendre »).
  const changeTransaction = (value: string) => {
    let nextType = type;
    if (value === 'VENTE' && type && LOCATION_ONLY_KEYS.includes(type)) nextType = undefined;
    if (value === 'LOCATION' && type && VENTE_ONLY_KEYS.includes(type)) nextType = undefined;
    push({ transactionType: value || undefined, type: nextType, page: '1' });
  };

  /* Fermer les menus au clic extérieur */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) setRegionOpen(false);
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Pastilles des filtres actifs (hors transaction et type, déjà visibles dans la barre).
  const activeChips: { key: string; icon: string; label: string; onRemove: () => void }[] = [];
  if (region) activeChips.push({ key: 'region', icon: 'fa-map-pin', label: region, onRemove: () => push({ region: undefined }) });
  if (ownerType) {
    const ot = OWNER_TYPES.find((o) => o.key === ownerType);
    if (ot) activeChips.push({ key: 'owner', icon: ot.icon, label: t(ot.tKey), onRemove: () => push({ ownerType: undefined }) });
  }
  if (isVerifiedOnly) activeChips.push({ key: 'verified', icon: 'fa-shield-halved', label: 'AlloVérifié', onRemove: () => push({ verified: undefined }) });
  if (q) activeChips.push({ key: 'q', icon: 'fa-magnifying-glass', label: `« ${q} »`, onRemove: () => push({ q: undefined }) });
  if (city) activeChips.push({ key: 'city', icon: 'fa-location-dot', label: city, onRemove: () => push({ city: undefined }) });
  if (hasPrice) {
    activeChips.push({
      key: 'price', icon: 'fa-coins',
      label: `${minPrice ? Number(minPrice).toLocaleString('fr-FR') : '0'} – ${maxPrice ? Number(maxPrice).toLocaleString('fr-FR') : '∞'} FCFA`,
      onRemove: () => push({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  return (
    <div className="mb-8 space-y-3">

      {/* ── Ligne 1 : transaction + région + panneau Filtres ───── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Tout / À louer / À vendre */}
        <div className="inline-flex rounded-full border border-line bg-white p-1 dark:bg-transparent">
          {TRANSACTIONS.map((tx) => {
            const active = (transactionType ?? '') === tx.key;
            return (
              <button
                key={tx.key || 'all'}
                onClick={() => changeTransaction(tx.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-gold-dark text-white' : 'text-sub hover:text-text'
                }`}
              >
                {t(tx.tKey)}
              </button>
            );
          })}
        </div>

        {/* Dropdown Région */}
        <div className="relative" ref={regionRef}>
          <button
            onClick={() => { setRegionOpen((o) => !o); setPanelOpen(false); }}
            className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
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
            <div className="absolute top-full left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-card border border-line rounded-2xl shadow-xl p-3 z-40">
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

        {/* Panneau Filtres : annonceur + AlloVérifié */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => { setPanelOpen((o) => !o); setRegionOpen(false); }}
            aria-expanded={panelOpen}
            className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
              panelCount > 0
                ? 'border-gold/70 bg-gold-pale text-gold-dark'
                : 'border-line bg-card text-text hover:border-gold/50 hover:bg-gold-pale hover:text-gold-dark'
            }`}
          >
            <i className="fa-solid fa-sliders text-gold-dark text-xs" />
            {t('filtersButton')}
            {panelCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-dark px-1.5 text-[11px] font-bold text-white">
                {panelCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-line rounded-2xl shadow-xl p-4 z-40 space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sub">{t('filtersOwner')}</p>
                <div className="flex flex-wrap gap-2">
                  {OWNER_TYPES.map((ot) => {
                    const isActive = activeOwnerType === ot.key;
                    return (
                      <button
                        key={ot.key}
                        onClick={() => push({ ownerType: ot.key || undefined, page: '1' })}
                        className={`${CHIP_BASE} ${isActive ? CHIP_ON : CHIP_OFF} !px-3.5 !py-1.5`}
                      >
                        <i className={`fa-solid ${ot.icon} text-xs ${isActive ? 'text-gray-900' : 'text-gold-dark'}`} />
                        {t(ot.tKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <button
                  onClick={() => push({ verified: isVerifiedOnly ? undefined : 'true', page: '1' })}
                  role="switch"
                  aria-checked={isVerifiedOnly}
                  className="flex w-full items-center justify-between gap-3 text-sm font-medium text-text"
                >
                  <span className="flex items-center gap-2">
                    <i className="fa-solid fa-shield-halved text-gold-dark text-xs" />
                    AlloVérifié
                  </span>
                  <span className={`relative h-6 w-11 rounded-full transition-colors ${isVerifiedOnly ? 'bg-gold-dark' : 'bg-line'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isVerifiedOnly ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tout effacer */}
        {hasFilters && (
          <button
            onClick={() => router.push('/listings')}
            className="flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm text-sub hover:text-red-500 transition-colors duration-200"
          >
            <i className="fa-solid fa-xmark text-xs" />
            {t('clearFilters')}
          </button>
        )}
      </div>

      {/* ── Ligne 2 : types de bien (adaptés à la transaction) ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {visibleTypes.map((typ) => {
          const isActive = activeType === typ.key;
          return (
            <button
              key={typ.key}
              onClick={() => push({ type: typ.key || undefined, page: '1' })}
              className={`${CHIP_BASE} ${isActive ? `${CHIP_ON} scale-[1.02]` : CHIP_OFF}`}
            >
              <i className={`fa-solid ${typ.icon} text-xs ${isActive ? 'text-gray-900' : 'text-gold-dark'}`} />
              {t(typ.tKey)}
            </button>
          );
        })}
      </div>

      {/* ── Filtres actifs ─────────────────────────────────────── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <span
              key={c.key}
              className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-pale py-1 pl-3 pr-1.5 text-xs font-medium text-gold-dark"
            >
              <i className={`fa-solid ${c.icon} text-[10px]`} />
              {c.label}
              <button
                onClick={c.onRemove}
                aria-label={t('removeFilter')}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-gold/20 transition-colors"
              >
                <i className="fa-solid fa-xmark text-[10px]" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
