'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Booking {
  id: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  totalAmount: string | number;
  listing: { title: string; city: string };
}

interface Stats {
  totalBookings: number;
  activeBookings: number;
  favorites: number;
  unreadMessages: number;
}

const BOOKING_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'En attente',  color: 'text-amber-600 bg-amber-50 border-amber-200'   },
  CONFIRMED: { label: 'Confirmée',   color: 'text-blue-600 bg-blue-50 border-blue-200'      },
  COMPLETED: { label: 'Terminée',    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  CANCELLED: { label: 'Annulée',     color: 'text-red-600 bg-red-50 border-red-200'         },
};

export default function LocataireDashboardPage() {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [bkRes, stRes] = await Promise.allSettled([
          api.get<Booking[]>('/bookings/mine', token),
          api.get<Stats>('/analytics/locataire', token),
        ]);
        if (bkRes.status === 'fulfilled') setBookings((bkRes.value ?? []).slice(0, 3));
        if (stRes.status === 'fulfilled') setStats(stRes.value);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  return (
    <div className="space-y-8">

      {/* Hero + CTA Devenir bailleur */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold-pale via-[#fef8e7] to-white p-6 sm:p-8">
        <div className="relative z-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold-dark">
            Mon espace locataire
          </p>
          <h1 className="text-2xl font-extrabold text-text sm:text-3xl">
            Bienvenue sur AlloAppart
          </h1>
          <p className="mt-2 max-w-lg text-sm text-sub">
            Retrouvez vos réservations, vos favoris et vos messages depuis votre tableau de bord.
          </p>

          {/* Devenir bailleur */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/become-bailleur"
              className="inline-flex items-center gap-2 rounded-full bg-gold-dark px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
            >
              <i className="fa-solid fa-house-chimney-user text-sm" />
              Devenir bailleur
            </Link>
            <p className="text-xs text-sub">
              Mettez votre bien en location en quelques minutes
            </p>
          </div>
        </div>
        {/* Décoration */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/10" />
        <div className="pointer-events-none absolute -bottom-6 right-16 h-20 w-20 rounded-full bg-gold/10" />
      </div>

      {/* Stats rapides */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-line bg-card p-5 h-24" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon="fa-calendar-check"
            label="Réservations"
            value={String(stats.totalBookings ?? 0)}
            href="/locataire/bookings"
          />
          <StatCard
            icon="fa-clock"
            label="En cours"
            value={String(stats.activeBookings ?? 0)}
            href="/locataire/bookings"
            accent="blue"
          />
          <StatCard
            icon="fa-heart"
            label="Favoris"
            value={String(stats.favorites ?? 0)}
            href="/locataire/favorites"
            accent="red"
          />
          <StatCard
            icon="fa-comment-dots"
            label="Messages non lus"
            value={String(stats.unreadMessages ?? 0)}
            href="/locataire/messages"
            accent="emerald"
          />
        </div>
      ) : null}

      {/* Dernières réservations */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-text">Mes dernières réservations</h2>
          <Link href="/locataire/bookings" className="text-xs font-medium text-gold-dark hover:underline">
            Tout voir →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-line bg-card h-20" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale">
              <i className="fa-solid fa-calendar-xmark text-xl text-gold-dark" />
            </div>
            <p className="text-sm font-medium text-text">Aucune réservation pour le moment</p>
            <p className="mt-1 text-xs text-sub">Explorez les annonces disponibles</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-pale px-4 py-2 text-xs font-medium text-gold-dark transition hover:bg-gold/20"
            >
              <i className="fa-solid fa-magnifying-glass text-xs" />
              Parcourir les annonces
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const s = BOOKING_STATUS_LABEL[b.status] ?? { label: b.status, color: 'text-sub bg-bg border-line' };
              return (
                <Link
                  key={b.id}
                  href="/locataire/bookings"
                  className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 transition hover:border-gold/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
                    <i className="fa-solid fa-house text-gold-dark text-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{b.listing.title}</p>
                    <p className="text-xs text-sub">
                      <i className="fa-solid fa-location-dot text-xs mr-1" />{b.listing.city} ·{' '}
                      {formatDate(b.startDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Raccourcis */}
      <div>
        <h2 className="mb-4 font-semibold text-text">Accès rapides</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickLink
            href="/"
            icon="fa-magnifying-glass"
            title="Rechercher un logement"
            sub="Parcourez les annonces disponibles"
          />
          <QuickLink
            href="/locataire/favorites"
            icon="fa-heart"
            title="Mes favoris"
            sub="Les biens que vous avez enregistrés"
          />
          <QuickLink
            href="/locataire/messages"
            icon="fa-comment-dots"
            title="Mes messages"
            sub="Communiquez avec les bailleurs"
          />
        </div>
      </div>

    </div>
  );
}

function StatCard({
  icon, label, value, href, accent = 'gold',
}: {
  icon: string;
  label: string;
  value: string;
  href: string;
  accent?: 'gold' | 'blue' | 'red' | 'emerald';
}) {
  const colors = {
    gold:    { bg: 'bg-gold-pale',        fg: 'text-gold-dark'     },
    blue:    { bg: 'bg-blue-50',          fg: 'text-blue-600'      },
    red:     { bg: 'bg-red-50',           fg: 'text-red-500'       },
    emerald: { bg: 'bg-emerald-50',       fg: 'text-emerald-600'   },
  };
  const c = colors[accent];
  return (
    <Link href={href} className="group rounded-2xl border border-line bg-card p-5 transition hover:border-gold/40">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${c.bg}`}>
        <i className={`fa-solid ${icon} text-sm ${c.fg}`} />
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="mt-0.5 text-xs text-sub">{label}</p>
    </Link>
  );
}

function QuickLink({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 transition hover:border-gold/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-pale">
        <i className={`fa-solid ${icon} text-gold-dark text-sm`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="mt-0.5 text-xs text-sub">{sub}</p>
      </div>
      <i className="fa-solid fa-chevron-right ml-auto text-xs text-sub" />
    </Link>
  );
}
