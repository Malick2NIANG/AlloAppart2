'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { COUNTRIES, DEFAULT_COUNTRY_ISO2, type CountryDialCode } from '@/lib/countries';

interface PhoneInputProps {
  /** Numéro complet stocké au format E.164, ex. "+221771234567". Chaîne vide si non renseigné. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Classe appliquée au conteneur (les deux blocs) — laisser vide pour le style par défaut pleine largeur. */
  className?: string;
}

const BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));
const DEFAULT_COUNTRY = BY_ISO2.get(DEFAULT_COUNTRY_ISO2)!;
// Tri par indicatif le plus long d'abord — un "+221771234567" doit matcher le
// Sénégal (221) avant un éventuel préfixe plus court partagé par un autre pays.
const BY_DIAL_DESC = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

// Drapeau en image (flagcdn.com) plutôt qu'en emoji Unicode — Windows ne
// dispose pas des glyphes couleur pour les emojis drapeau et affiche à la
// place les deux lettres du code pays (ex. "SN"). Même limitation déjà
// contournée pour le sélecteur de langue (cf. LanguageSwitcher.tsx).
function FlagImg({ iso2, size = 18 }: { iso2: string; size?: number }) {
  const code = iso2.toLowerCase();
  const height = Math.round(size * 0.75);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- domaine externe (flagcdn.com), pas géré par next/image ici
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt=""
      width={size}
      height={height}
      loading="lazy"
      style={{ width: size, height, objectFit: 'cover', borderRadius: 2, flexShrink: 0, display: 'block' }}
    />
  );
}

function parsePhone(value: string): { country: CountryDialCode; local: string } {
  if (!value) return { country: DEFAULT_COUNTRY, local: '' };
  const cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    const rest = cleaned.slice(1);
    const match = BY_DIAL_DESC.find((c) => rest.startsWith(c.dial));
    if (match) return { country: match, local: rest.slice(match.dial.length) };
    return { country: DEFAULT_COUNTRY, local: rest };
  }
  // Anciennes valeurs enregistrées sans "+" — conservées telles quelles comme
  // numéro local, pays par défaut présélectionné.
  return { country: DEFAULT_COUNTRY, local: cleaned };
}

export default function PhoneInput({
  value, onChange, id, placeholder, disabled, autoFocus, className,
}: PhoneInputProps) {
  const t = useTranslations('phoneInput');
  const initial = useMemo(() => parsePhone(value), []); // eslint-disable-line react-hooks/exhaustive-deps -- init unique, resynchro gérée par l'effet ci-dessous
  const [iso2, setIso2] = useState(initial.country.iso2);
  const [local, setLocal] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value);

  // Resynchronise si la valeur externe change (ex. chargement async après le
  // montage) — sans écraser une saisie locale déjà en cours.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const p = parsePhone(value);
    setIso2(p.country.iso2);
    setLocal(p.local);
    lastEmitted.current = value;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const country = BY_ISO2.get(iso2) ?? DEFAULT_COUNTRY;

  const emit = (dial: string, nextLocal: string) => {
    const cleanLocal = nextLocal.replace(/\D/g, '');
    const next = cleanLocal ? `+${dial}${cleanLocal}` : '';
    lastEmitted.current = next;
    onChange(next);
  };

  const handleSelectCountry = (c: CountryDialCode) => {
    setIso2(c.iso2);
    setOpen(false);
    emit(c.dial, local);
  };

  const handleLocalChange = (raw: string) => {
    setLocal(raw);
    emit(country.dial, raw);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(q));
  }, [search]);

  return (
    <div ref={wrapRef} className={`relative flex items-stretch gap-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setSearch('');
          setOpen((o) => !o);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('countryButtonLabel')}
        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-text hover:border-gold/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FlagImg iso2={country.iso2} />
        <span className="text-xs text-sub">+{country.dial}</span>
        <i className={`fa-solid fa-chevron-down text-[9px] text-sub transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder ?? t('numberPlaceholder')}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full min-w-0 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {open && (
        <div
          role="listbox"
          aria-label={t('countryButtonLabel')}
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-72 max-w-[90vw] overflow-hidden rounded-xl border border-line bg-card shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-xs text-text placeholder:text-sub focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-sub">{t('noResults')}</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  role="option"
                  aria-selected={c.iso2 === iso2}
                  onClick={() => handleSelectCountry(c)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-gold-pale dark:hover:bg-gold-dark/15 ${
                    c.iso2 === iso2 ? 'bg-gold-pale/50 dark:bg-gold-dark/15 font-semibold text-gold-dark' : 'text-text'
                  }`}
                >
                  <FlagImg iso2={c.iso2} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-sub">+{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
