'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Verification } from '@/types';

interface RecentRating {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  raterFirstName: string;
  raterLastName: string;
  raterAvatar?: string | null;
}

interface AgentStats {
  assigned: number;
  inProgress: number;
  doneThisMonth: number;
  doneTotal: number;
  todayMissions: (Verification & { listing?: { id: string; title: string; city: string; address?: string } })[];
  avgRating: number | null;
  totalRatings: number;
  recentRatings: RecentRating[];
}

export default function AgentDashboard() {
  const { getToken } = useAuth();
  const [stats,   setStats]   = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    void (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const data = await api.get<AgentStats>('/verifications/stats', token);
        setStats(data);
      } catch {}
      finally { setLoading(false); }
    })();
  // getToken est stable depuis Clerk — pas de boucle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text">
          {greeting}, <span className="text-gold-dark">Agent</span>
        </h1>
        <p className="text-sm text-sub mt-0.5">
          {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-card p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            icon="fa-calendar-check"
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label="Assignées"
            value={stats.assigned}
          />
          <StatCard
            icon="fa-person-walking"
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
            label="En cours"
            value={stats.inProgress}
          />
          <StatCard
            icon="fa-shield-check"
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            label="Ce mois"
            value={stats.doneThisMonth}
          />
          <StatCard
            icon="fa-trophy"
            iconBg="bg-gold-pale"
            iconColor="text-gold-dark"
            label="Total certifiées"
            value={stats.doneTotal}
          />
          {/* Note moyenne */}
          <div className="rounded-2xl border border-line bg-card p-4 col-span-2 sm:col-span-1 flex flex-col justify-between">
            <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <i className="fa-solid fa-star text-amber-500 text-sm" />
            </div>
            {stats.avgRating !== null ? (
              <>
                <p className="text-2xl font-extrabold text-text">{stats.avgRating.toFixed(1)}<span className="text-sm font-normal text-sub">/5</span></p>
                <p className="text-xs text-sub mt-0.5">Note moyenne · {stats.totalRatings} avis</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-sub">—</p>
                <p className="text-xs text-sub mt-0.5">Pas encore d'avis</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Missions du jour */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text flex items-center gap-2">
            <i className="fa-solid fa-sun text-gold-dark text-xs" />
            Missions du jour
          </h2>
          <Link href="/agent/verifications" className="text-xs text-gold-dark hover:underline">
            Toutes les missions →
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-card p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : !stats || stats.todayMissions.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <i className="fa-solid fa-coffee text-2xl text-sub mb-3 block" />
            <p className="font-semibold text-text text-sm">Aucune mission aujourd'hui</p>
            <p className="text-xs text-sub mt-1">Profitez de votre journée — de nouvelles missions peuvent être assignées à tout moment.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.todayMissions.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        )}
      </section>

      {/* Derniers avis reçus */}
      {!loading && stats && stats.recentRatings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-text flex items-center gap-2">
              <i className="fa-solid fa-star text-amber-400 text-xs" />
              Derniers avis reçus
            </h2>
          </div>
          <div className="rounded-2xl border border-line bg-card divide-y divide-line overflow-hidden">
            {stats.recentRatings.map((r) => {
              const initials = `${r.raterFirstName[0]}${r.raterLastName[0]}`.toUpperCase();
              const diffDays = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
              const timeStr = diffDays === 0 ? 'Aujourd\'hui' : diffDays === 1 ? 'Hier' : `il y a ${diffDays}j`;
              return (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                  {r.raterAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.raterAvatar} alt={r.raterFirstName}
                      className="h-8 w-8 rounded-full object-cover border border-line shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-bg border border-line flex items-center justify-center text-[10px] font-bold text-sub shrink-0 mt-0.5">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold text-text">{r.raterFirstName} {r.raterLastName[0]}.</p>
                      <span className="text-[10px] text-sub">{timeStr}</span>
                    </div>
                    <div className="flex gap-0.5 mb-1">
                      {[1,2,3,4,5].map((n) => (
                        <span key={n} className={`text-sm leading-none ${n <= r.rating ? 'text-amber-400' : 'text-line'}`}>★</span>
                      ))}
                    </div>
                    {r.comment && (
                      <p className="text-xs text-sub leading-relaxed line-clamp-2">{r.comment}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Raccourcis */}
      <section>
        <h2 className="text-sm font-bold text-text mb-3">Accès rapide</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/agent/verifications"
            className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-gold-pale flex items-center justify-center shrink-0">
              <i className="fa-solid fa-shield-halved text-gold-dark" />
            </div>
            <div>
              <p className="font-semibold text-text text-sm group-hover:text-gold-dark transition-colors">Mes missions</p>
              <p className="text-xs text-sub">Assignées, en cours, terminées</p>
            </div>
            <i className="fa-solid fa-chevron-right text-sub text-xs ml-auto group-hover:text-gold-dark transition-colors" />
          </Link>

          <Link
            href="/agent/messages"
            className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-comment-dots text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-text text-sm group-hover:text-gold-dark transition-colors">Messages</p>
              <p className="text-xs text-sub">Échanges avec les bailleurs</p>
            </div>
            <i className="fa-solid fa-chevron-right text-sub text-xs ml-auto group-hover:text-gold-dark transition-colors" />
          </Link>

          <Link
            href="/profil"
            className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-user text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-text text-sm group-hover:text-gold-dark transition-colors">Mon profil</p>
              <p className="text-xs text-sub">Coordonnées, photo</p>
            </div>
            <i className="fa-solid fa-chevron-right text-sub text-xs ml-auto group-hover:text-gold-dark transition-colors" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <i className={`fa-solid ${icon} ${iconColor} text-sm`} />
      </div>
      <p className="text-2xl font-extrabold text-text">{value}</p>
      <p className="text-xs text-sub mt-0.5">{label}</p>
    </div>
  );
}

function MissionCard({ mission }: { mission: Verification & { listing?: { id: string; title: string; city: string; address?: string } } }) {
  const time = new Date(mission.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const statusColor = mission.status === 'IN_PROGRESS' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600';
  const statusLabel = mission.status === 'IN_PROGRESS' ? 'En cours' : 'Planifiée';

  return (
    <Link
      href="/agent/verifications"
      className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 hover:border-gold/40 transition-all"
    >
      {/* Heure */}
      <div className="shrink-0 text-center w-12">
        <p className="text-lg font-extrabold text-gold-dark leading-none">{time}</p>
        <p className="text-[9px] text-sub uppercase tracking-wide mt-0.5">Prévu</p>
      </div>

      <div className="w-px h-10 bg-line shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text text-sm truncate">{mission.listing?.title ?? 'Mission'}</p>
        <p className="text-xs text-sub truncate mt-0.5">
          <i className="fa-solid fa-location-dot text-gold-dark text-[10px] mr-1" />
          {mission.listing?.city}{mission.listing?.address ? ` · ${mission.listing.address}` : ''}
        </p>
      </div>

      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${statusColor}`}>
        {statusLabel}
      </span>
    </Link>
  );
}
