export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export const localeLabels: Record<Locale, { label: string; countryCode: string; name: string }> = {
  fr: { label: 'FR', countryCode: 'fr', name: 'Français' },
  en: { label: 'EN', countryCode: 'gb', name: 'English' },
};
