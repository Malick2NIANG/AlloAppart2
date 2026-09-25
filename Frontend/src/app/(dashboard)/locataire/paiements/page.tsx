'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { Booking } from '@/types';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';
import { useToast } from '@/components/ui/Toast';

const PER_PAGE_OPTIONS = [10, 20, 50] as const;
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ESCROW_CLS: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-gold-pale text-gold-dark border-gold/30',
  HELD:             'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40',
  RELEASED:         'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40',
  REFUNDED:         'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40',
};

const ESCROW_ICON: Record<string, string> = {
  AWAITING_PAYMENT: 'fa-clock',
  HELD:             'fa-shield-halved',
  RELEASED:         'fa-circle-check',
  REFUNDED:         'fa-rotate-left',
};

export default function PaiementsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const t = useTranslations('locataire');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [perPage,  setPerPage]  = useState<number>(PER_PAGE_OPTIONS[0]);
  const [page,     setPage]     = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null);

  const ESCROW_LABEL: Record<string, string> = {
    AWAITING_PAYMENT: t('escrowAwaitingShort'),
    HELD:             t('escrowHeldShort'),
    RELEASED:         t('escrowReleasedShort'),
    REFUNDED:         t('escrowRefunded'),
  };

  const STATUS_LABEL: Record<string, string> = {
    PENDING:   t('statusPending'),
    CONFIRMED: t('statusConfirmed'),
    CANCELLED: t('statusCancelled'),
    COMPLETED: t('statusCompleted'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.get<Booking[]>('/bookings/mine', token);
      setBookings(data);
    } catch {
      setError(t('paymentsError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { void load(); }, [load]);

  // Le reçu PDF n'est pas une page à naviguer : c'est un fichier binaire
  // renvoyé par le backend, à récupérer avec le token d'auth puis déclencher
  // en téléchargement (même pattern que locataire/bookings/page.tsx).
  const downloadReceipt = async (bookingId: string) => {
    const token = await getToken();
    if (!token) return;
    setDownloadingReceipt(bookingId);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('error');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `recu-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('receiptError'));
    } finally {
      setDownloadingReceipt(null);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination suite à un changement de recherche/taille de page
  useEffect(() => { setPage(1); }, [search, perPage]);

  /* ── Agrégats financiers ── */
  const paid    = bookings.filter((b) => ['HELD', 'RELEASED'].includes(b.escrowStatus));
  const refunded = bookings.filter((b) => b.escrowStatus === 'REFUNDED');
  const pending  = bookings.filter((b) => b.escrowStatus === 'AWAITING_PAYMENT');

  const totalPaid     = paid.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalRefunded = refunded.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalPending  = pending.reduce((s, b) => s + Number(b.totalAmount), 0);

  const q = search.trim().toLowerCase();
  const filteredBookings = bookings.filter((b) =>
    !q
    || (b.listing?.title ?? '').toLowerCase().includes(q)
    || (b.listing?.city ?? '').toLowerCase().includes(q),
  );
  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / perPage));
  const safePage  = Math.min(page, pageCount);
  const visibleBookings = filteredBookings.slice((safePage - 1) * perPage, safePage * perPage);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-line bg-card h-20" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-line bg-card h-16" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{error}</p>
        <button onClick={() => void load()} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-rotate-right mr-1.5" />{t('retryBtn')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-text">{t('paymentsTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('paymentsDesc')}</p>
      </div>

      {/* KPI Cards financières */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold mb-1">{t('kpiTotalPaid')}</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatPrice(totalPaid)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{t('transactionsCount', { count: paid.length })}</p>
        </div>
        <div className="rounded-2xl border border-gold/30 dark:border-gold-dark/20 bg-gold-pale dark:bg-gold-dark/10 p-4">
          <p className="text-[10px] uppercase tracking-widest text-gold-dark font-semibold mb-1">{t('kpiPending')}</p>
          <p className="text-2xl font-bold text-gold-dark">{formatPrice(totalPending)}</p>
          <p className="text-xs text-gold-dark/70 mt-0.5">{t('transactionsCount', { count: pending.length })}</p>
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4">
          <p className="text-[10px] uppercase tracking-widest text-red-600 dark:text-red-400 font-semibold mb-1">{t('kpiRefunded')}</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatPrice(totalRefunded)}</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{t('transactionsCount', { count: refunded.length })}</p>
        </div>
      </div>

      {/* Liste des transactions — cartes + recherche toujours visibles, même à 0, pour rester cohérent avec AlloVérifié/boost/bookings/favoris */}
      <>
        <BookingSearchRow
          search={search} onSearchChange={setSearch} searchPlaceholder={t('searchPlaceholder')}
          perPage={perPage} onPerPageChange={setPerPage} perPageOptions={PER_PAGE_OPTIONS}
          rowsLabel={t('rowsLabel')}
        />

        {filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-sub">
              {bookings.length === 0 ? t('noTransactionsHint') : t('noSearchResults')}
            </p>
            {bookings.length === 0 && (
              <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                <i className="fa-solid fa-magnifying-glass text-xs" /> {t('browseBtn')}
              </Link>
            )}
          </div>
        ) : (
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-line">
            <p className="text-xs font-semibold text-sub uppercase tracking-widest">
              {t('transactionsCount', { count: filteredBookings.length })}
            </p>
          </div>
          <div className="divide-y divide-line">
            {visibleBookings.map((b) => {
              const isOpen = expandedId === b.id;
              const listing = b.listing;
              const nights  = b.endDate
                ? Math.ceil((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / 86_400_000)
                : null;
              return (
                <div key={b.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : b.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gold-pale/30 dark:hover:bg-gold-dark/10 transition-colors group text-left"
                  >
                    {/* Icône escrow */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${ESCROW_CLS[b.escrowStatus] ?? 'bg-card border-line text-sub'}`}>
                      <i className={`fa-solid ${ESCROW_ICON[b.escrowStatus] ?? 'fa-circle'} text-sm`} />
                    </div>

                    {/* Infos */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text truncate group-hover:text-gold-dark transition-colors">
                        {b.listing?.title ?? b.listingId}
                      </p>
                      <p className="text-xs text-sub mt-0.5">
                        {formatDate(b.startDate)}
                        {b.endDate ? ` → ${formatDate(b.endDate)}` : ''}
                        <span className="mx-1.5">·</span>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </p>
                    </div>

                    {/* Montant + statut escrow */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-text">{formatPrice(b.totalAmount)}</p>
                      <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESCROW_CLS[b.escrowStatus] ?? 'bg-card border-line text-sub'}`}>
                        {ESCROW_LABEL[b.escrowStatus] ?? b.escrowStatus}
                      </span>
                    </div>

                    <i className={`fa-solid fa-chevron-down text-[10px] text-sub transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-4 bg-bg/40">
                      {/* Détails du séjour */}
                      <div className="rounded-2xl border border-line bg-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                          <i className="fa-regular fa-calendar text-gold-dark text-xs" />
                          {t('stayDetails')}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-sub font-semibold mb-1">{t('arrivalLabel')}</p>
                            <p className="font-medium text-text">{formatDate(b.startDate)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-sub font-semibold mb-1">{t('departureLabel')}</p>
                            <p className="font-medium text-text">{b.endDate ? formatDate(b.endDate) : '—'}</p>
                          </div>
                          {nights != null && (
                            <div className="col-span-2">
                              <p className="text-[10px] uppercase tracking-widest text-sub font-semibold mb-1">{t('durationLabel')}</p>
                              <p className="font-medium text-text">{t('nightsCount', { count: nights })}</p>
                            </div>
                          )}
                        </div>
                        {listing && (
                          <div className="pt-3 border-t border-line flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
                              <i className="fa-solid fa-house text-gold-dark text-sm" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text truncate">{listing.title}</p>
                              <p className="text-xs text-sub">{listing.city}</p>
                            </div>
                            <Link
                              href={`/listings/${listing.id}`}
                              className="ml-auto shrink-0 text-xs text-gold-dark hover:underline"
                            >
                              {t('viewListingLink')} <i className="fa-solid fa-arrow-right text-[10px]" />
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Paiement */}
                      <div className="rounded-2xl border border-line bg-card p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                          <i className="fa-solid fa-wallet text-gold-dark text-xs" />
                          {t('paymentSection')}
                        </h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-sub">{t('totalAmountLabel')}</span>
                          <span className="font-bold text-gold-dark text-base">{formatPrice(b.totalAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-sub">{t('paymentStatusLabel')}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${ESCROW_CLS[b.escrowStatus] ?? 'bg-card text-sub border-line'}`}>
                            <i className={`fa-solid ${ESCROW_ICON[b.escrowStatus] ?? 'fa-circle'} text-[10px]`} />
                            {ESCROW_LABEL[b.escrowStatus] ?? b.escrowStatus}
                          </span>
                        </div>
                        {b.paymentRef && (
                          <div className="flex items-center justify-between text-sm pt-1 border-t border-line">
                            <span className="text-sub">{t('paymentRefLabel')}</span>
                            <span className="font-mono text-xs text-sub">{b.paymentRef}</span>
                          </div>
                        )}
                        <div className="pt-1 flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => void downloadReceipt(b.id)}
                            disabled={downloadingReceipt === b.id}
                            className="text-xs text-gold-dark hover:underline flex items-center gap-1 disabled:opacity-50"
                          >
                            {downloadingReceipt === b.id
                              ? <i className="fa-solid fa-spinner fa-spin text-[11px]" />
                              : <i className="fa-solid fa-file-pdf text-[11px]" />}
                            {t('viewReceiptLink')}
                          </button>
                          <Link
                            href={`/locataire/bookings/${b.id}`}
                            className="text-xs text-sub hover:text-text transition-colors flex items-center gap-1"
                          >
                            {t('viewBookingLink')} <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          )}

          <BookingPagination
            page={safePage} pageCount={pageCount} onPageChange={setPage}
            previousLabel={t('previous')} nextLabel={t('next')}
            pageOfLabel={t('pageOf', { page: safePage, total: pageCount })}
          />
      </>
    </div>
  );
}
