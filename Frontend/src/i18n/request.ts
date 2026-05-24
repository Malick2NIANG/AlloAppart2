import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('allo-locale')?.value;
  const locale: Locale =
    raw && (locales as readonly string[]).includes(raw)
      ? (raw as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
