import type { Locale } from './config';

/**
 * Écrit le cookie de langue `allo-locale` directement depuis le navigateur.
 *
 * Pourquoi en plus de l'action serveur `setLocale` : une Server Action peut
 * être refusée par Next.js quand l'origine de la requête ne correspond pas à
 * l'hôte (tunnel de développement, proxy qui réécrit Host, etc.). Le cookie
 * étant lu par next-intl (voir i18n/request.ts), l'écrire côté client rend le
 * changement de langue fiable quoi qu'il arrive ; `setLocale` ne sert alors
 * plus qu'à synchroniser la préférence côté serveur (e-mails, SMS, notifications).
 *
 * Mêmes attributs que le cookie posé par `setLocale` (chemin, durée, SameSite).
 */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `allo-locale=${locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}
