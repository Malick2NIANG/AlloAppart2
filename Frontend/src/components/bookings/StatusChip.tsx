'use client';

import { useTranslations } from 'next-intl';
import type { BookingStatus } from '@/types';
import { BOOKING_STATUS_STYLES } from '@/lib/bookingStatus';

/**
 * Badge de statut de réservation — partagé par les 3 rôles (locataire,
 * bailleur, admin). Avant ce composant, chaque page dupliquait sa propre
 * table de couleurs/libellés ; celle de l'admin ne couvrait que 4 des 9
 * statuts (oubliait tout le cycle de vie du bail mensuel) et une des
 * versions dupliquées traduisait CANCELLED par "Refusée" au lieu
 * d'"Annulée". Une seule source ici (couleurs dans lib/bookingStatus.ts,
 * libellés dans le namespace i18n "bookingStatus") élimine ces divergences.
 */
export function StatusChip({ status }: { status: BookingStatus }) {
  const t = useTranslations('bookingStatus');
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${BOOKING_STATUS_STYLES[status]}`}>
      {t(status)}
    </span>
  );
}
