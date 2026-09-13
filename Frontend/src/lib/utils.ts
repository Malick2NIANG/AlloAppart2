import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: string | number, currency = 'XOF'): string {
  return new Intl.NumberFormat('fr-SN', { style: 'currency', currency }).format(Number(amount));
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' }).format(new Date(dateStr));
}

/**
 * Ouvre un onglet vide de façon SYNCHRONE — à appeler tout au début du
 * handler de clic, AVANT tout `await`. L'URL de paiement PayDunya n'est
 * connue qu'après un appel API asynchrone (POST /payments/initiate ou
 * équivalent) ; si on attend cette réponse avant d'appeler `window.open`,
 * les navigateurs (Chrome, Safari…) bloquent le popup car il n'est plus
 * perçu comme le résultat direct d'un geste utilisateur. On réserve donc
 * l'onglet immédiatement et on le redirige une fois l'URL obtenue.
 */
export function openPaymentTab(): Window | null {
  return window.open('', '_blank');
}

/** Redirige l'onglet réservé par `openPaymentTab` vers l'URL de paiement. */
export function redirectPaymentTab(tab: Window | null, url: string): void {
  if (tab && !tab.closed) {
    tab.location.href = url;
  } else {
    // Onglet bloqué par le navigateur (rare, mais possible) — on retombe sur
    // la redirection classique dans l'onglet courant plutôt que de laisser
    // l'utilisateur sans aucune réaction au clic.
    window.location.href = url;
  }
}

/** Ferme l'onglet réservé si l'initiation du paiement échoue côté serveur. */
export function closePaymentTab(tab: Window | null): void {
  if (tab && !tab.closed) tab.close();
}
