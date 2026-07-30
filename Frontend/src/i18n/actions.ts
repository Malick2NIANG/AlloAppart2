'use server';

import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { locales, type Locale } from './config';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Persiste la langue choisie.
 *
 * Deux destinations :
 *  - le cookie `allo-locale`, lu par next-intl pour l'interface
 *  - la colonne `locale` de l'utilisateur, lue par le backend pour les emails,
 *    SMS et notifications (le backend ne voit pas les cookies du navigateur)
 *
 * La synchro backend est volontairement non bloquante : si l'API est
 * indisponible, la langue de l'interface change quand même.
 */
export async function setLocale(locale: Locale) {
  if (!(locales as readonly string[]).includes(locale)) return;

  const store = await cookies();
  store.set('allo-locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  try {
    const { userId, getToken } = await auth();
    if (!userId) return; // visiteur anonyme : rien à persister

    const token = await getToken();
    if (!token) return;

    await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ locale }),
    });
  } catch {
    // Échec silencieux : la préférence sera resynchronisée au prochain changement.
  }
}
