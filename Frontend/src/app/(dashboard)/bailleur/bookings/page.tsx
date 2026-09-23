'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Booking } from '@/types';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import BookingActions from './BookingActions';
import ContractCard from '@/components/bookings/ContractCard';
import { BookingCard } from '@/components/bookings/BookingCard';
import { StatFilterCard } from '@/components/bookings/StatFilterCard';
import { BookingSearchRow } from '@/components/bookings/BookingSearchRow';
import { BookingPagination } from '@/components/bookings/BookingPagination';

const PER_PAGE_OPTIONS = [6, 12, 24] as const;
// Une agence/bailleur reste dans un volume raisonnable de réservations
// reçues (contrairement à l'admin, qui voit tout le fait sur AlloAppart) —
// on récupère tout en une fois pour un filtrage/recherche/pagination
// entièrement client, comme sur la page locataire.
const FETCH_LIMIT = 500;

export default function BailleurBookingsPage() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const t            = useTranslations('bailleur');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Booking[]; total: number; page: number; limit: number }>(
        `/bookings/received?page=1&limit=${FETCH_LIMIT}`,
        token
      );
      setBookings(res.data);
    } catch {
      setError(t('bookingsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [getToken, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial, setState après résolution async
  useEffect(() => { fetchData(); }, [fetchData]);

  // Nuitée : PENDING/CONFIRMED/CANCELLED/COMPLETED — Mensuel : REQUESTED/APPROVED/ACTIVE/REJECTED/TERMINATED
  const pending  = bookings.filter((b) => b.status === 'PENDING' || b.status === 'REQUESTED');
  const active   = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'APPROVED' || b.status === 'ACTIVE');
  const archived = bookings.filter((b) =>
    b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED' || b.status === 'TERMINATED');

  // Onglet par défaut : "En attente" s'il y a quelque chose à traiter, sinon
  // le premier onglet non vide — même logique que la page locataire. Ne se
  // déclenche qu'une fois, au tout premier chargement.
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'archived'>('pending');
  const tabInitialized = useRef(false);
  useEffect(() => {
    if (loading || tabInitialized.current) return;
    tabInitialized.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- choix de l'onglet par défaut une fois les données async arrivées, ne peut pas être calculé au rendu
    if (pending.length > 0) setActiveTab('pending');
    else if (active.length > 0) setActiveTab('confirmed');
    else if (archived.length > 0) setActiveTab('archived');
  }, [loading, pending.length, active.length, archived.length]);

  // Les 3 cartes restent toujours affichées (même quand un groupe est vide),
  // même pattern StatFilterCard que les pages admin — contrairement aux
  // anciens onglets pill (BookingTabs) qui se masquaient s'ils étaient vides.
  const tabs = [
    { key: 'pending' as const,   label: t('sectionPending'),   icon: 'fa-clock',        color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',   items: pending },
    { key: 'confirmed' as const, label: t('sectionConfirmed'), icon: 'fa-circle-check', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', items: active },
    { key: 'archived' as const,  label: t('sectionArchived'),  icon: 'fa-box-archive',  color: 'text-sub',                              bg: 'bg-card',                              items: archived },
  ];
  const currentTab = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  // Recherche + pagination client — propres à chaque onglet.
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<typeof PER_PAGE_OPTIONS[number]>(6);

  const switchTab = (key: 'pending' | 'confirmed' | 'archived') => {
    setActiveTab(key);
    setSearch('');
    setPage(1);
  };

  const q = search.trim().toLowerCase();
  const filteredItems = currentTab
    ? currentTab.items.filter((b) =>
        !q ||
        (b.listing?.title ?? '').toLowerCase().includes(q) ||
        (b.listing?.city ?? '').toLowerCase().includes(q) ||
        `${b.tenant?.firstName ?? ''} ${b.tenant?.lastName ?? ''}`.toLowerCase().includes(q),
      )
    : [];
  const pageCount    = Math.max(1, Math.ceil(filteredItems.length / perPage));
  const clampedPage  = Math.min(page, pageCount);
  const visibleItems = filteredItems.slice((clampedPage - 1) * perPage, clampedPage * perPage);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('bookingsTitle')}</h1>
        {!loading && !error && (
          <p className="mt-1 text-sm text-sub">
            {t('bookingsCount', { count: bookings.length })}
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-gold-dark font-medium">
                <i className="fa-solid fa-circle text-[8px]" />
                {t('bookingsPending', { count: pending.length })}
              </span>
            )}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height="280px" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
          <p className="text-sm text-sub">{error}</p>
          <button onClick={() => void fetchData()} className="mt-4 btn-gold text-sm">
            <i className="fa-solid fa-rotate-right mr-1.5" />{t('retry')}
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-calendar-check text-2xl text-gold-dark" />
          </div>
          <p className="font-semibold text-text">{t('bookingsEmpty')}</p>
          <p className="mt-1 text-sm text-sub">{t('bookingsEmptyHint')}</p>
          <Link href="/publier" className="btn-gold mt-5 inline-flex items-center gap-2 text-sm">
            <i className="fa-solid fa-plus text-xs" />{t('bookingsPublish')}
          </Link>
        </div>
      ) : currentTab && (
        <>
          {/* Stats par statut — doublent aussi de filtre cliquable (même
              pattern que les pages admin). */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {tabs.map((tab) => (
              <StatFilterCard
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
                value={tab.items.length}
                color={tab.color}
                bg={tab.bg}
                active={currentTab.key === tab.key}
                onClick={() => switchTab(tab.key)}
                selectedLabel={t('filterSelected')}
              />
            ))}
          </div>

          {/* Recherche + lignes par page */}
          <BookingSearchRow
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder={t('searchPlaceholder')}
            perPage={perPage}
            onPerPageChange={(n) => { setPerPage(n as typeof PER_PAGE_OPTIONS[number]); setPage(1); }}
            perPageOptions={PER_PAGE_OPTIONS}
            rowsLabel={t('rowsLabel')}
          />

          {/* Grille de l'onglet actif */}
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-sub">{t('noSearchResults')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleItems.map((booking) => (
                <LandlordBookingCard
                  key={booking.id}
                  booking={booking}
                  onActionDone={fetchData}
                  toast={toast}
                  getToken={getToken}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          <BookingPagination
            page={clampedPage}
            pageCount={pageCount}
            onPageChange={setPage}
            previousLabel={t('previous')}
            nextLabel={t('next')}
            pageOfLabel={t('pageOf', { page: clampedPage, total: pageCount })}
          />
        </>
      )}
    </div>
  );
}

/* ─── Carte réservation bailleur (coquille partagée + slots bailleur) ── */
function LandlordBookingCard({
  booking, onActionDone, toast, getToken,
}: {
  booking: Booking;
  onActionDone: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  getToken: () => Promise<string | null>;
}) {
  const router = useRouter();
  const t = useTranslations('bailleur');

  const contactTenant = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const room = await api.post<{ id: string }>(
        '/messages/rooms',
        { listingId: booking.listingId, tenantId: booking.tenantId },
        token
      );
      router.push(`/bailleur/messages/${room.id}`);
    } catch {
      toast.error(t('contactError'));
    }
  };

  return (
    <BookingCard
      booking={booking}
      subtitle={
        <p className="text-sm text-sub mt-1">
          <i className="fa-solid fa-user text-xs text-gold-dark mr-1" />
          {booking.tenant?.firstName} {booking.tenant?.lastName}
        </p>
      }
      actions={
        <div className="flex flex-col items-start gap-2">
          <BookingActions
            bookingId={booking.id}
            status={booking.status}
            terminationEffectiveAt={booking.terminationEffectiveAt}
            terminationRequestedByTenant={booking.terminationRequestedById === booking.tenantId}
            onActionDone={onActionDone}
            toast={toast}
          />
          <button
            onClick={() => void contactTenant()}
            className="text-xs font-medium text-gold-dark hover:underline inline-flex items-center gap-1"
          >
            <i className="fa-solid fa-comment-dots text-xs" />
            {t('contactTenant')}
          </button>
        </div>
      }
      footer={
        // Contrat de bail — uniquement une fois le bail mensuel actif
        booking.bookingType === 'MONTHLY' &&
        (booking.status === 'ACTIVE' || booking.status === 'TERMINATED') && (
          <ContractCard bookingId={booking.id} viewerRole="landlord" />
        )
      }
    />
  );
}
