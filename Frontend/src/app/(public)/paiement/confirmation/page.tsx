'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import type { Booking } from '@/types';

export default function PaiementConfirmationPage() {
  const params = useSearchParams();
  const bookingId = params.get('booking_id');
  const cpmTransId = params.get('cpm_trans_id');
  const { getToken } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- error state set in conditional branch
      setError('Référence de réservation introuvable.');
      setLoading(false);
      return;
    }
    getToken().then(async (token) => {
      if (!token) {
        setError('Non authentifié.');
        setLoading(false);
        return;
      }
      try {
        const b = await api.get<Booking>(`/bookings/${bookingId}`, token);
        setBooking(b);
      } catch {
        setError('Impossible de récupérer les détails de votre réservation.');
      } finally {
        setLoading(false);
      }
    });
  }, [bookingId, getToken]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-gold-dark" />
      </main>
    );
  }

  const isPaid = booking?.escrowStatus === 'HELD' || booking?.status === 'CONFIRMED';

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-md text-center">
        {error ? (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <i className="fa-solid fa-circle-xmark text-3xl text-red-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">Une erreur s&apos;est produite</h1>
            <p className="mt-3 text-sm text-sub">{error}</p>
            <Link href="/espace" className="btn-gold mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
              Retour à mon espace
            </Link>
          </>
        ) : isPaid ? (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 ring-4 ring-green-100">
              <i className="fa-solid fa-circle-check text-3xl text-green-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">Paiement confirmé !</h1>
            <p className="mt-3 text-sm text-sub">
              Votre réservation est en cours de traitement. Le bailleur a été notifié.
            </p>
            {cpmTransId && (
              <p className="mt-2 text-xs text-sub">
                Référence transaction : <span className="font-mono text-text">{cpmTransId}</span>
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/locataire/bookings" className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
                <i className="fa-solid fa-calendar-check" /> Mes réservations
              </Link>
              <Link href="/listings" className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all">
                Continuer à explorer
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100">
              <i className="fa-solid fa-clock text-3xl text-amber-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">Paiement en attente</h1>
            <p className="mt-3 text-sm text-sub">
              Votre paiement est en cours de vérification. Vous recevrez une confirmation dans quelques instants.
            </p>
            <Link href="/locataire/bookings" className="btn-gold mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
              Suivre ma réservation
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
