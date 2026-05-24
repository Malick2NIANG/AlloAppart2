'use server';

import { cookies } from 'next/headers';
import { locales, type Locale } from './config';

export async function setLocale(locale: Locale) {
  if (!(locales as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set('allo-locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
