'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';
import { MOCK_LISTINGS } from '@/lib/mockListings';
import { api } from '@/lib/api';
import type { User as ApiUser, MessageRoom } from '@/types';

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';
type ActiveMode = 'locataire' | 'bailleur';

const DEMO_LOCATAIRE = { name: 'Mamadou Diallo', initials: 'MD', email: 'mamadou@demo.sn', roles: ['locataire']             };
const DEMO_BAILLEUR  = { name: 'Binta Sarr',     initials: 'BS', email: 'binta@demo.sn',   roles: ['bailleur']              };
const DEMO_DUAL      = { name: 'Ousmane Thiaw',  initials: 'OT', email: 'ousmane@demo.sn', roles: ['locataire', 'bailleur'] };
const DEMO_ADMIN     = { name: 'Modou Kane',      initials: 'MK', email: 'admin@demo.sn',   roles: ['admin']                };
const DEMO_AGENT     = { name: 'Awa Diop',        initials: 'AD', email: 'agent@demo.sn',   roles: ['agent']                };

const MOCK_FAVORITES   = [MOCK_LISTINGS[0], MOCK_LISTINGS[2], MOCK_LISTINGS[5]].filter(Boolean);
const MOCK_MY_LISTINGS = [MOCK_LISTINGS[10], MOCK_LISTINGS[11], MOCK_LISTINGS[12]].filter(Boolean);


const MOCK_DEMANDES = [
  { id: 'd1', from: 'Abdou Diagne',  avatar: 'AD', listing: 'Appartement 3P Plateau', date: '19/05', status: 'pending'  },
  { id: 'd2', from: 'Rokhaya Gueye', avatar: 'RG', listing: 'Studio Meublé Point E',  date: '18/05', status: 'accepted' },
  { id: 'd3', from: 'Seydou Mbaye',  avatar: 'SM', listing: 'Chambre Mermoz',          date: '16/05', status: 'rejected' },
];

function useGreeting(t: ReturnType<typeof useTranslations<'espace'>>) {
  const h = new Date().getHours();
  if (h < 12) return t('greetingMorning');
  if (h < 18) return t('greetingAfternoon');
  return t('greetingEvening');
}

function formatPrice(p: number) {
  return p.toLocaleString('fr-SN') + ' FCFA';
}

/* ── Mini listing card ───────────────────────────────────────────────── */
function MiniCard({
  listing,
  perMonth,
  onRemove,
}: {
  listing: (typeof MOCK_LISTINGS)[0];
  perMonth: string;
  onRemove?: () => void;
}) {
  if (!listing) return null;
  return (
    <div className="group relative flex gap-3 rounded-2xl border border-line bg-card p-3 hover:border-gold/40 transition-all">
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
        <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
        {listing.isVerified && (
          <div className="absolute top-1 left-1">
            <AlloVerifieBadge />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{listing.title}</p>
        <p className="truncate text-xs text-sub">{listing.city}</p>
        <p className="mt-1 text-xs font-bold text-gold-dark">{formatPrice(listing.price)}{perMonth}</p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-sub hover:bg-bg hover:text-red-500 transition opacity-0 group-hover:opacity-100"
        >
          <i className="fa-solid fa-xmark text-[10px]" />
        </button>
      )}
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────── */
function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslations<'espace'>> }) {
  const colorMap: Record<string, string> = {
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
  };
  const labelMap: Record<string, string> = {
    pending:  t('statusPending'),
    accepted: t('statusAccepted'),
    rejected: t('statusRejected'),
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

const MOCK_ADMIN_STATS = [
  { count: 1247, labelKey: 'statUtilisateurs', icon: 'fa-users',         color: 'text-blue-500'    },
  { count: 3891, labelKey: 'statAnnoncesTotal', icon: 'fa-house',        color: 'text-gold-dark'   },
  { count: 14,   labelKey: 'statVerifs',        icon: 'fa-shield-check', color: 'text-emerald-600' },
  { count: 3,    labelKey: 'statSignalements',  icon: 'fa-flag',         color: 'text-red-500'     },
];

const MOCK_VERIF_QUEUE = [
  { id: 'v1', listing: 'Appart. 3P Dakar Plateau',   owner: 'Binta Sarr',    date: '19/05', status: 'pending'  },
  { id: 'v2', listing: 'Villa 5P Almadies',           owner: 'Cheikh Ndoye',  date: '18/05', status: 'pending'  },
  { id: 'v3', listing: 'Studio Meublé Point E',       owner: 'Rokhaya Gueye', date: '15/05', status: 'verified' },
  { id: 'v4', listing: 'Chambre Mermoz Sacré-Cœur',  owner: 'Absa Diallo',   date: '14/05', status: 'verified' },
];

/* ── VIEW: Admin ─────────────────────────────────────────────────────── */
function AdminView({ userName, initials, t }: { userName: string; initials: string; t: ReturnType<typeof useTranslations<'espace'>> }) {
  const greeting = useGreeting(t);
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-line bg-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600 ring-2 ring-red-100">
              {initials}
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-widest">{t('roleAdmin')}</p>
              <h2 className="text-xl font-extrabold text-text">{greeting}, {userName.split(' ')[0]} !</h2>
            </div>
          </div>
          <Link href="/dashboard/admin"
            className="inline-flex items-center gap-2 rounded-full bg-gold text-gray-900 px-4 py-2 text-sm font-bold hover:bg-gold-dark hover:text-white transition-colors">
            <i className="fa-solid fa-table-columns text-xs" /> {t('viewAdminDashboard')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {MOCK_ADMIN_STATS.map((s) => (
          <div key={s.labelKey} className="rounded-2xl border border-line bg-card p-4 text-center">
            <i className={`fa-solid ${s.icon} ${s.color} text-xl mb-2 block`} />
            <p className="text-2xl font-extrabold text-text">{s.count.toLocaleString('fr-SN')}</p>
            <p className="text-xs text-sub">{t(s.labelKey as 'statUtilisateurs')}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-shield-halved text-gold-dark text-sm" /> {t('sectionVerifQueue')}
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">2</span>
          </h3>
          <Link href="/dashboard/admin/listings" className="text-xs text-sub hover:text-gold-dark transition-colors">{t('seeAll')}</Link>
        </div>
        <div className="rounded-2xl border border-line overflow-hidden">
          {MOCK_VERIF_QUEUE.map((v, i) => (
            <div key={v.id} className={`flex items-center gap-4 px-4 py-3.5 ${i < MOCK_VERIF_QUEUE.length - 1 ? 'border-b border-line/50' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${v.status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <i className={`fa-solid ${v.status === 'verified' ? 'fa-check' : 'fa-clock'} text-[11px]`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{v.listing}</p>
                <p className="text-xs text-sub">{v.owner}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${v.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {v.status === 'verified' ? t('verifStatusVerified') : t('verifStatusPending')}
                </span>
                <p className="text-[10px] text-sub">{v.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── VIEW: Agent ─────────────────────────────────────────────────────── */
function AgentView({ userName, initials, t }: { userName: string; initials: string; t: ReturnType<typeof useTranslations<'espace'>> }) {
  const greeting = useGreeting(t);
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-line bg-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-blue-600 ring-2 ring-blue-100">
              {initials}
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-widest">{t('roleAgent')}</p>
              <h2 className="text-xl font-extrabold text-text">{greeting}, {userName.split(' ')[0]} !</h2>
            </div>
          </div>
          <div className="flex gap-3">
            {([
              { count: 8,  labelKey: 'verifDone'   },
              { count: 2,  labelKey: 'verifPending' },
            ] as const).map((s) => (
              <div key={s.labelKey} className="rounded-2xl border border-line bg-bg px-4 py-2.5 text-center min-w-20">
                <p className="text-lg font-extrabold text-gold-dark">{s.count}</p>
                <p className="text-[10px] text-sub">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-shield-check text-gold-dark text-sm" /> {t('sectionVerifQueue')}
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">2</span>
          </h3>
          <Link href="/dashboard/agent/verifications" className="text-xs text-sub hover:text-gold-dark transition-colors">{t('seeAll')}</Link>
        </div>
        <div className="rounded-2xl border border-line overflow-hidden">
          {MOCK_VERIF_QUEUE.map((v, i) => (
            <div key={v.id} className={`flex items-center gap-4 px-4 py-3.5 ${i < MOCK_VERIF_QUEUE.length - 1 ? 'border-b border-line/50' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${v.status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <i className={`fa-solid ${v.status === 'verified' ? 'fa-check' : 'fa-clock'} text-[11px]`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{v.listing}</p>
                <p className="text-xs text-sub">{v.owner}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${v.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {v.status === 'verified' ? t('verifStatusVerified') : t('verifStatusPending')}
                </span>
                <p className="text-[10px] text-sub">{v.date}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 btn-gold rounded-full px-5 py-2 text-sm inline-flex items-center gap-2">
          <i className="fa-solid fa-shield-halved" /> {t('verifStart')}
        </button>
      </section>
    </div>
  );
}

/* ── VIEW: Visitor ───────────────────────────────────────────────────── */
function VisitorView({ t }: { t: ReturnType<typeof useTranslations<'espace'>> }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
        <i className="fa-solid fa-house-chimney text-3xl text-gold-dark" />
      </div>
      <h2 className="text-2xl font-extrabold text-text">{t('visitorTitle')}</h2>
      <p className="mt-3 max-w-sm text-sm text-sub">{t('visitorDesc')}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/sign-in" className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
          <i className="fa-solid fa-arrow-right-to-bracket" /> {t('signIn')}
        </Link>
        <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all">
          <i className="fa-solid fa-user-plus" /> {t('createAccount')}
        </Link>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3 w-full max-w-2xl">
        {[
          { icon: 'fa-heart',         titleKey: 'featureFavoris',  descKey: 'featureFavorisDesc'  },
          { icon: 'fa-comments',      titleKey: 'featureMessages', descKey: 'featureMessagesDesc' },
          { icon: 'fa-house-chimney', titleKey: 'featureAnnonces', descKey: 'featureAnnoncesDesc' },
        ].map((f) => (
          <div key={f.titleKey} className="rounded-2xl border border-line bg-card p-5 text-left">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-pale">
              <i className={`fa-solid ${f.icon} text-gold-dark`} />
            </div>
            <p className="text-sm font-semibold text-text">{t(f.titleKey as 'featureFavoris')}</p>
            <p className="mt-1 text-xs text-sub">{t(f.descKey as 'featureFavorisDesc')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── VIEW: Onboarding ────────────────────────────────────────────────── */
function OnboardingView({ userName, t }: { userName: string; t: ReturnType<typeof useTranslations<'espace'>> }) {
  const greeting = useGreeting(t);
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale">
        <i className="fa-solid fa-wave-square text-2xl text-gold-dark" />
      </div>
      <h2 className="text-2xl font-extrabold text-text">{greeting}, {userName.split(' ')[0]} !</h2>
      <p className="mt-2 text-sm text-sub">{t('onboardingDesc')}</p>
      <Link href="/onboarding" className="btn-gold mt-8 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
        <i className="fa-solid fa-rocket" /> {t('onboardingCta')}
      </Link>
    </div>
  );
}

/* ── Shared: Messages preview ─────────────────────────────────────────── */
function MessagesPreview({ t, rooms, currentUserId }: {
  t: ReturnType<typeof useTranslations<'espace'>>;
  rooms: MessageRoom[];
  currentUserId?: string;
}) {
  const preview = rooms.slice(0, 3);
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text flex items-center gap-2">
          <i className="fa-solid fa-comments text-gold-dark text-sm" />
          {t('sectionMessages')}
        </h3>
        <Link href="/messages" className="text-xs text-sub hover:text-gold-dark transition-colors">
          {t('openMessaging')}
        </Link>
      </div>
      {preview.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-sub">
          Aucune conversation.{' '}
          <Link href="/listings" className="text-gold-dark hover:underline">Parcourir les annonces</Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-line overflow-hidden">
          {preview.map((room, i) => {
            const others = room.participants.filter((p) => p.id !== currentUserId);
            const name = others.length > 0 ? `${others[0].firstName} ${others[0].lastName}` : 'Conversation';
            const initials = others.length > 0 ? `${others[0].firstName[0]}${others[0].lastName?.[0] ?? ''}`.toUpperCase() : '?';
            const lastMsg = room.messages?.[0];

            return (
              <Link key={room.id} href={`/messages?room=${room.id}`}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-card transition-colors ${i < preview.length - 1 ? 'border-b border-line/50' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale text-xs font-bold text-gold-dark">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text truncate">{name}</p>
                    {lastMsg && (
                      <p className="text-[10px] text-sub whitespace-nowrap">
                        {new Date(lastMsg.createdAt).toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <p className="truncate text-xs text-sub">{lastMsg?.content ?? room.listing?.title ?? 'Annonce'}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── VIEW: Locataire dashboard ───────────────────────────────────────── */
function LocataireView({ userName, initials, t, rooms, currentUserId }: { userName: string; initials: string; t: ReturnType<typeof useTranslations<'espace'>>; rooms: MessageRoom[]; currentUserId?: string }) {
  const [favorites, setFavorites] = useState(MOCK_FAVORITES);
  const greeting = useGreeting(t);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-line bg-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale text-lg font-bold text-gold-dark ring-2 ring-gold/30">
              {initials}
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-widest">{t('roleLocataire')}</p>
              <h2 className="text-xl font-extrabold text-text">{greeting}, {userName.split(' ')[0]} !</h2>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { count: favorites.length, labelKey: 'statFavoris'  },
              { count: rooms.length,     labelKey: 'statMessages' },
              { count: 12,               labelKey: 'statConsulted' },
            ].map((s) => (
              <div key={s.labelKey} className="rounded-2xl border border-line bg-bg px-4 py-2.5 text-center min-w-16">
                <p className="text-lg font-extrabold text-gold-dark">{s.count}</p>
                <p className="text-[10px] text-sub">{t(s.labelKey as 'statFavoris')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-heart text-gold-dark text-sm" /> {t('sectionFavoris')}
          </h3>
          <Link href="/listings" className="text-xs text-sub hover:text-gold-dark transition-colors">{t('seeAll')}</Link>
        </div>
        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-sub">
            {t('noFavoris')}{' '}
            <Link href="/listings" className="text-gold-dark hover:underline">{t('browseCta')}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((l) => (
              <Link key={l.id} href={`/listings/${l.id}`}>
                <MiniCard listing={l} perMonth={t('perMonth')} onRemove={() => setFavorites((prev) => prev.filter((f) => f.id !== l.id))} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <MessagesPreview t={t} rooms={rooms} currentUserId={currentUserId} />
    </div>
  );
}

/* ── VIEW: Bailleur dashboard ────────────────────────────────────────── */
function BailleurView({ userName, initials, t, rooms, currentUserId }: { userName: string; initials: string; t: ReturnType<typeof useTranslations<'espace'>>; rooms: MessageRoom[]; currentUserId?: string }) {
  const greeting = useGreeting(t);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-line bg-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale text-lg font-bold text-gold-dark ring-2 ring-gold/30">
              {initials}
            </div>
            <div>
              <p className="text-xs text-sub uppercase tracking-widest">{t('roleBailleur')}</p>
              <h2 className="text-xl font-extrabold text-text">{greeting}, {userName.split(' ')[0]} !</h2>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { count: MOCK_MY_LISTINGS.length, labelKey: 'statAnnonces'  },
              { count: rooms.length,            labelKey: 'statMessages'  },
              { count: MOCK_DEMANDES.length,    labelKey: 'statDemandes'  },
            ].map((s) => (
              <div key={s.labelKey} className="rounded-2xl border border-line bg-bg px-4 py-2.5 text-center min-w-16">
                <p className="text-lg font-extrabold text-gold-dark">{s.count}</p>
                <p className="text-[10px] text-sub">{t(s.labelKey as 'statAnnonces')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-house-chimney text-gold-dark text-sm" /> {t('sectionAnnonces')}
          </h3>
          <Link href="/publier" className="inline-flex items-center gap-1.5 rounded-full bg-gold text-gray-900 px-4 py-1.5 text-xs font-bold hover:bg-gold-dark hover:text-white transition-colors">
            <i className="fa-solid fa-plus text-[10px]" /> {t('publish')}
          </Link>
        </div>
        {MOCK_MY_LISTINGS.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-sub">{t('noAnnonces')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_MY_LISTINGS.map((l) => (
              <Link key={l.id} href={`/listings/${l.id}`}>
                <MiniCard listing={l} perMonth={t('perMonth')} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-inbox text-gold-dark text-sm" /> {t('sectionDemandes')}
          </h3>
          <Link href="/messages" className="text-xs text-sub hover:text-gold-dark transition-colors">{t('seeAll')}</Link>
        </div>
        <div className="rounded-2xl border border-line overflow-hidden">
          {MOCK_DEMANDES.map((d, i) => (
            <div key={d.id} className={`flex items-center gap-4 px-4 py-3.5 ${i < MOCK_DEMANDES.length - 1 ? 'border-b border-line/50' : ''}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale text-xs font-bold text-gold-dark">
                {d.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{d.from}</p>
                <p className="truncate text-xs text-sub">{d.listing}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={d.status} t={t} />
                <p className="text-[10px] text-sub">{d.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <MessagesPreview t={t} rooms={rooms} currentUserId={currentUserId} />
    </div>
  );
}

/* ── VIEW: Dual-role toggle ───────────────────────────────────────────── */
function DualRoleView({ userName, initials, t, rooms, currentUserId }: { userName: string; initials: string; t: ReturnType<typeof useTranslations<'espace'>>; rooms: MessageRoom[]; currentUserId?: string }) {
  const [mode, setMode] = useState<ActiveMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('aa_active_mode') as ActiveMode) || 'locataire';
    }
    return 'locataire';
  });

  const toggle = (m: ActiveMode) => {
    setMode(m);
    localStorage.setItem('aa_active_mode', m);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-1.5 w-fit">
        {(['locataire', 'bailleur'] as const).map((m) => (
          <button key={m} onClick={() => toggle(m)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${mode === m ? 'bg-gold text-gray-900 shadow-sm' : 'text-sub hover:text-text'}`}>
            <i className={`fa-solid ${m === 'locataire' ? 'fa-key' : 'fa-house-chimney'} text-xs`} />
            {m === 'locataire' ? t('roleLocataire') : t('roleBailleur')}
          </button>
        ))}
      </div>
      {mode === 'locataire'
        ? <LocataireView userName={userName} initials={initials} t={t} rooms={rooms} currentUserId={currentUserId} />
        : <BailleurView  userName={userName} initials={initials} t={t} rooms={rooms} currentUserId={currentUserId} />
      }
    </div>
  );
}

/* ── Root component ──────────────────────────────────────────────────── */
export default function EspaceClient() {
  const { isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const t = useTranslations('espace');
  const [demoRole, setDemoRole] = useState<DemoRole>('visitor');
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [apiRooms, setApiRooms] = useState<MessageRoom[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aa_demo_role') as DemoRole | null;
    if (stored && ['visitor', 'locataire', 'bailleur', 'dual', 'admin', 'agent'].includes(stored)) setDemoRole(stored);
    setMounted(true);
    const handler = (e: Event) => setDemoRole((e as CustomEvent<DemoRole>).detail);
    window.addEventListener('aa-demo-change', handler);
    return () => window.removeEventListener('aa-demo-change', handler);
  }, []);

  // Fetch real user + rooms when signed in
  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then((token) => {
      if (!token) return;
      Promise.all([
        api.get<ApiUser>('/auth/me', token).catch(() => null),
        api.get<MessageRoom[]>('/messages/rooms', token).catch(() => [] as MessageRoom[]),
      ]).then(([u, rooms]) => {
        if (u) {
          setApiUser(u);
          // Sync to localStorage as cache for offline/ssr fallback
          localStorage.setItem('aa_user_roles', JSON.stringify(u.roles));
        }
        setApiRooms(rooms);
      });
    });
  }, [isSignedIn, getToken]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  const effectiveSignedIn = isSignedIn || demoRole !== 'visitor';
  if (!effectiveSignedIn) return <VisitorView t={t} />;

  /* ── Demo mode ── */
  if (!isSignedIn) {
    const demoUser = demoRole === 'bailleur' ? DEMO_BAILLEUR
                   : demoRole === 'dual'     ? DEMO_DUAL
                   : demoRole === 'admin'    ? DEMO_ADMIN
                   : demoRole === 'agent'    ? DEMO_AGENT
                   :                          DEMO_LOCATAIRE;
    const emptyRooms: MessageRoom[] = [];
    if (demoUser.roles.includes('admin'))    return <AdminView     userName={demoUser.name} initials={demoUser.initials} t={t} />;
    if (demoUser.roles.includes('agent'))    return <AgentView     userName={demoUser.name} initials={demoUser.initials} t={t} />;
    if (demoUser.roles.length > 1)           return <DualRoleView  userName={demoUser.name} initials={demoUser.initials} t={t} rooms={emptyRooms} />;
    if (demoUser.roles.includes('bailleur')) return <BailleurView  userName={demoUser.name} initials={demoUser.initials} t={t} rooms={emptyRooms} />;
    return                                          <LocataireView userName={demoUser.name} initials={demoUser.initials} t={t} rooms={emptyRooms} />;
  }

  /* ── Real Clerk user ── */
  const realName    = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Utilisateur';
  const realInitials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  // Use API roles if loaded; fall back to localStorage cache while loading
  const userRoles: string[] = apiUser?.roles ?? (() => {
    try { return JSON.parse(localStorage.getItem('aa_user_roles') ?? '[]'); } catch { return []; }
  })();

  if (userRoles.length === 0 && !apiUser) return (
    <div className="flex items-center justify-center py-32">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
    </div>
  );
  if (userRoles.length === 0) return <OnboardingView userName={realName} t={t} />;

  const hasBailleur  = userRoles.includes('BAILLEUR');
  const hasLocataire = userRoles.includes('LOCATAIRE');
  if (hasBailleur && hasLocataire) return <DualRoleView   userName={realName} initials={realInitials} t={t} rooms={apiRooms} currentUserId={userId ?? undefined} />;
  if (hasBailleur)                 return <BailleurView   userName={realName} initials={realInitials} t={t} rooms={apiRooms} currentUserId={userId ?? undefined} />;
  return                                  <LocataireView  userName={realName} initials={realInitials} t={t} rooms={apiRooms} currentUserId={userId ?? undefined} />;
}
