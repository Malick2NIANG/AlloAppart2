import type { BookingStatus } from '@/types';

export type BookingStatusGroup = 'pending' | 'active' | 'archived';

// Un statut de réservation appartient à un seul de ces 3 groupes, quel que
// soit le flux (nuitée ou bail mensuel) — utilisés pour les onglets
// "En attente / Confirmées / Archivées", identiques sur les 3 rôles
// (locataire, bailleur, admin). Avant ce fichier, ce regroupement était
// dupliqué indépendamment dans chacune des 3 pages.
export const PENDING_STATUSES:  BookingStatus[] = ['PENDING', 'REQUESTED'];
export const ACTIVE_STATUSES:   BookingStatus[] = ['CONFIRMED', 'APPROVED', 'ACTIVE'];
export const ARCHIVED_STATUSES: BookingStatus[] = ['CANCELLED', 'COMPLETED', 'REJECTED', 'TERMINATED'];

export function bookingStatusGroup(status: BookingStatus): BookingStatusGroup {
  if (PENDING_STATUSES.includes(status)) return 'pending';
  if (ACTIVE_STATUSES.includes(status)) return 'active';
  return 'archived';
}

// Couleurs de badge partagées par les 3 rôles — une seule source de vérité.
// Avant ce lot, cette table était dupliquée 3 fois (locataire, bailleur),
// avec une 3ᵉ version côté admin qui ne couvrait que 4 des 9 statuts et
// ignorait entièrement le cycle de vie du bail mensuel (REQUESTED/APPROVED/
// REJECTED/ACTIVE/TERMINATED) — un admin voyait alors un badge brut non
// traduit et sans couleur pour toute réservation mensuelle.
export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING:    'bg-gold-pale text-gold-dark',
  CONFIRMED:  'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  CANCELLED:  'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
  COMPLETED:  'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
  REQUESTED:  'bg-gold-pale text-gold-dark',
  APPROVED:   'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  REJECTED:   'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
  ACTIVE:     'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
  TERMINATED: 'bg-gray-100 dark:bg-gray-950/40 text-gray-600 dark:text-gray-400',
};
