'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import type { Booking } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function PaiementConfirmationPage() {
  const params    = useSearchParams();
  const bookingId = params.get('booking_id');
  const { getToken } = useAuth();
  const t = useTranslations('payment');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-SN';

  const [booking,  setBooking]  = useState<Booking | null>(null);
  const [status,   setStatus]   = useState<'loading' | 'confirmed' | 'pending' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setErrorMsg(t('noBookingRef'));
      setStatus('error');
      return;
    }

    getToken().then(async (token) => {
      if (!token) {
        setErrorMsg(t('sessionExpired'));
        setStatus('error');
        return;
      }

      try {
        const res = await fetch(`${API}/payments/verify/${bookingId}`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? t('cantVerify'));
        }

        const b: Booking = await res.json() as Booking;
        setBooking(b);
        setStatus(b.status === 'CONFIRMED' ? 'confirmed' : 'pending');
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : t('verifyError'));
        setStatus('error');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, getToken]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
          </div>
          <p className="text-sm font-medium text-text">{t('verifying')}</p>
          <p className="mt-1 text-xs text-sub">{t('verifyingSubtitle')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-md">

        {/* ── Erreur ─────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100">
              <i className="fa-solid fa-circle-xmark text-3xl text-red-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">{t('errorTitle')}</h1>
            <p className="mt-3 text-sm text-sub">{errorMsg}</p>
            <Link
              href="/locataire/bookings"
              className="btn-gold mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              <i className="fa-solid fa-calendar-check" /> {t('myBookings')}
            </Link>
          </div>
        )}

        {/* ── Confirmé ───────────────────────────────────────── */}
        {status === 'confirmed' && booking && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 ring-4 ring-green-100">
              <i className="fa-solid fa-circle-check text-3xl text-green-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">{t('confirmedTitle')}</h1>
            <p className="mt-3 text-sm text-sub">{t('confirmedDesc')}</p>

            <div className="mt-6 rounded-2xl border border-line bg-card p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-sub uppercase tracking-wide">{t('detailsLabel')}</p>
              {booking.listing?.title && (
                <p className="font-semibold text-text">{booking.listing.title}</p>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-sub">{t('arrivalLabel')}</span>
                <span className="font-medium text-text">
                  {new Date(booking.startDate).toLocaleDateString(numLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {booking.endDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-sub">{t('departureLabel')}</span>
                  <span className="font-medium text-text">
                    {new Date(booking.endDate).toLocaleDateString(numLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-line pt-2 mt-2">
                <span className="font-semibold text-text">{t('totalPaid')}</span>
                <span className="font-bold text-gold-dark">
                  {Number(booking.totalAmount).toLocaleString(numLocale)} FCFA
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/locataire/bookings"
                className="btn-gold inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                <i className="fa-solid fa-calendar-check" /> {t('myBookings')}
              </Link>
              <Link
                href="/listings"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all"
              >
                {t('continueExploring')}
              </Link>
            </div>
          </div>
        )}

        {/* ── En attente ─────────────────────────────────────── */}
        {status === 'pending' && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100">
              <i className="fa-solid fa-clock text-3xl text-amber-500" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">{t('pendingTitle')}</h1>
            <p className="mt-3 text-sm text-sub">{t('pendingDesc')}</p>
            <p className="mt-3 text-xs text-sub">{t('pendingRetryHint')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/locataire/bookings"
                className="btn-gold inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                <i className="fa-solid fa-calendar-check" /> {t('trackReservation')}
              </Link>
              <button
                onClick={() => { setStatus('loading'); window.location.reload(); }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all"
              >
                <i className="fa-solid fa-rotate-right" /> {t('retryBtn')}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
