import { getLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import NavbarClient from './NavbarClient';

export default async function Navbar() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('nav');

  return (
    <NavbarClient
      locale={locale}
      labels={{
        listings:          t('listings'),
        search:            t('search'),
        mySpace:           t('mySpace'),
        login:             t('login'),
        register:          t('register'),
        openMenu:          t('openMenu'),
        closeMenu:         t('closeMenu'),
        searchPlaceholder: t('searchPlaceholder'),
      }}
    />
  );
}
