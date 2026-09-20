'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import type { Booking } from '@/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { StatusChip } from './StatusChip';

const FALLBACK_IMG = 'https://via.placeholder.com/600x400?text=AlloAppart';

/**
 * Coquille visuelle commune aux 3 pages "réservations" (locataire, bailleur,
 * admin) : photo + statut en overlay, titre + dates + prix, puis une zone
 * d'actions dont le contenu reste entièrement au rôle appelant (les actions
 * possibles diffèrent trop d'un rôle à l'autre pour être partagées ici).
 * `subtitle` et `footer` permettent d'insérer des infos propres au rôle
 * (nom du locataire pour bailleur/admin, contrat de bail, preuves de
 * litige...) sans dupliquer la structure de la carte elle-même.
 */
export function BookingCard({
  booking, onClick, subtitle, actions, footer,
}: {
  booking: Booking;
  /** Absent = carte non cliquable (ex. admin, qui n'a pas de page de détail dédiée). */
  onClick?: () => void;
  subtitle?: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
}) {
  const img = booking.listing?.images?.[0] ?? FALLBACK_IMG;

  return (
    <div className="flex flex-col gap-3">
      <div className="listing-card group flex flex-col">

        {/* Photo + statut */}
        <div
          className={`relative h-40 overflow-hidden rounded-t-2xl ${onClick ? 'cursor-pointer' : ''}`}
          onClick={onClick}
        >
          <Image
            src={img}
            alt={booking.listing?.title ?? ''}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3">
            <StatusChip status={booking.status} />
          </div>
        </div>

        {/* Bien + dates + prix (+ infos propres au rôle) */}
        <div className={onClick ? 'p-4 cursor-pointer' : 'p-4'} onClick={onClick}>
          <p className="font-semibold text-text truncate group-hover:text-gold-dark transition-colors">
            {booking.listing?.title ?? booking.listingId}
          </p>
          <p className="text-sm text-sub mt-1 flex items-center gap-1.5">
            <i className="fa-regular fa-calendar text-gold-dark text-xs" />
            {formatDate(booking.startDate)}
            {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
          </p>
          <p className="text-sm font-semibold text-text mt-1">{formatPrice(booking.totalAmount)}</p>
          {subtitle}
        </div>

        {/* Actions — même gabarit sur toutes les cartes, quel que soit le rôle */}
        <div className="border-t border-line p-4 pt-3" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      </div>

      {/* Contenu additionnel hors carte (contrat de bail, preuves de litige...) */}
      {footer}
    </div>
  );
}
