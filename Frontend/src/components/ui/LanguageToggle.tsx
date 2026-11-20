'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setLocale } from '@/i18n/actions';
import { writeLocaleCookie } from '@/i18n/clientLocale';
import { locales, localeLabels, type Locale } from '@/i18n/config';
import { useLocaleTransition } from './LocaleTransition';
import { FlagIcon } from './LanguageSwitcher';

interface Props {
  currentLocale: Locale;
  /** Classes additionnelles (placement). */
  className?: string;
}

/**
 * Sélecteur de langue en interrupteur à deux positions (FR | EN), pour le
 * mobile (< 768 px) : un seul geste pour changer de langue, pas de liste
 * déroulante. Sur PC, `LanguageSwitcher` (liste déroulante) reste utilisé.
 *
 * Fiabilité : le cookie de langue est écrit côté navigateur AVANT l'action
 * serveur (qui peut être refusée derrière un tunnel/proxy) ; l'action ne sert
 * qu'à synchroniser la préférence côté serveur, et son échec n'empêche pas le
 * changement de langue de l'interface.
 */
export default function LanguageToggle({ currentLocale, className = '' }: Props) {
  const router = useRouter();
  const { pending, run } = useLocaleTransition();
  const t = useTranslations('nav');

  const activeIndex = Math.max(0, locales.indexOf(currentLocale));

  const handleSelect = (locale: Locale) => {
    if (pending || locale === currentLocale) return;
    writeLocaleCookie(locale);
    run(async () => {
      try {
        await setLocale(locale);
      } catch {
        // La langue de l'interface est déjà changée via le cookie.
      }
      router.refresh();
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('selectLanguage')}
      className={`relative inline-grid h-11 w-36 shrink-0 grid-cols-2 rounded-full border border-line bg-card p-1 ${pending ? 'opacity-60' : ''} ${className}`}
    >
      {/* Pastille qui glisse sous la langue active. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-gold shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {locales.map((locale) => {
        const info = localeLabels[locale];
        const active = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={info.name}
            disabled={pending}
            onClick={() => handleSelect(locale)}
            className={`relative z-10 flex touch-manipulation items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${
              active ? 'text-[#1c1c1c]' : 'text-sub hover:text-text'
            }`}
          >
            <FlagIcon countryCode={info.countryCode} />
            <span>{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}
