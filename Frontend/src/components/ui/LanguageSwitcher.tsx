'use client';

import { useTransition, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';
import { setLocale } from '@/i18n/actions';
import { locales, localeLabels, type Locale } from '@/i18n/config';

interface Props {
  currentLocale: Locale;
}

function FlagIcon({ countryCode }: { countryCode: string }) {
  const style: React.CSSProperties = { borderRadius: '2px', flexShrink: 0, display: 'block' };

  if (countryCode === 'fr') return (
    <svg viewBox="0 0 3 2" width="22" height="15" style={style}>
      <rect width="1" height="2" fill="#002395" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ED2939" />
    </svg>
  );

  if (countryCode === 'gb') return (
    <svg viewBox="0 0 60 40" width="22" height="15" style={{ ...style, overflow: 'hidden' }}>
      <rect width="60" height="40" fill="#012169" />
      <line x1="0" y1="0" x2="60" y2="40" stroke="#fff" strokeWidth="12" />
      <line x1="60" y1="0" x2="0" y2="40" stroke="#fff" strokeWidth="12" />
      <line x1="0" y1="0" x2="60" y2="40" stroke="#C8102E" strokeWidth="7" />
      <line x1="60" y1="0" x2="0" y2="40" stroke="#C8102E" strokeWidth="7" />
      <line x1="0" y1="20" x2="60" y2="20" stroke="#fff" strokeWidth="14" />
      <line x1="30" y1="0" x2="30" y2="40" stroke="#fff" strokeWidth="14" />
      <line x1="0" y1="20" x2="60" y2="20" stroke="#C8102E" strokeWidth="8" />
      <line x1="30" y1="0" x2="30" y2="40" stroke="#C8102E" strokeWidth="8" />
    </svg>
  );

  return null;
}

export default function LanguageSwitcher({ currentLocale }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (locale: Locale) => {
    if (locale === currentLocale) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  const t = useTranslations('nav');
  const current = localeLabels[currentLocale];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Changer de langue"
        disabled={pending}
        className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-semibold text-sub transition hover:border-gold/50 hover:text-gold-dark disabled:opacity-50"
      >
        <FlagIcon countryCode={current.countryCode} />
        <span>{current.label}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('selectLanguage')}
          className="absolute right-0 top-11 z-50 min-w-38 overflow-hidden rounded-xl border border-line bg-card shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {locales.map((locale) => {
            const info = localeLabels[locale];
            const active = locale === currentLocale;
            return (
              <button
                key={locale}
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(locale)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-gold-pale ${
                  active ? 'font-semibold text-gold-dark' : 'font-medium text-sub hover:text-text'
                }`}
              >
                <FlagIcon countryCode={info.countryCode} />
                <span className="flex-1 text-left">{info.name}</span>
                {active && <Check size={14} className="text-gold-dark" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
