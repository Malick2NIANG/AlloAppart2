'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface AgentRatingItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  raterFirstName: string;
  raterLastName: string;
  raterAvatar?: string | null;
}

interface AgentProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  bio?: string | null;
  phone?: string | null;
  memberSince: string;
  completedMissions: number;
  avgRating: number | null;
  totalRatings: number;
  ratings: AgentRatingItem[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`text-base leading-none ${n <= Math.round(value) ? 'text-amber-400' : 'text-line'}`}>★</span>
      ))}
    </span>
  );
}

function experienceBadge(missions: number) {
  if (missions >= 20) return { label: 'Expérimenté', color: 'bg-purple-100 text-purple-700' };
  if (missions >= 5)  return { label: 'Actif',        color: 'bg-blue-100 text-blue-700'    };
  return                     { label: 'Nouvel agent', color: 'bg-amber-100 text-amber-700'  };
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)   return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AgentProfilePage() {
  const params = useParams<{ id: string }>();
  const [agent,   setAgent]   = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get<AgentProfile>(`/auth/agents/${params.id}`)
      .then(setAgent)
      .catch(() => setError('Agent introuvable ou non disponible.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-32 bg-line rounded-2xl" />
        <div className="h-24 bg-line rounded-2xl" />
        <div className="h-48 bg-line rounded-2xl" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <i className="fa-solid fa-user-slash text-4xl text-line mb-4" />
        <p className="text-sub">{error || 'Agent introuvable'}</p>
        <Link href="/bailleur/agents" className="mt-4 inline-block text-sm text-gold-dark hover:underline">
          ← Retour à la liste des agents
        </Link>
      </div>
    );
  }

  const initials = `${agent.firstName[0]}${agent.lastName[0]}`.toUpperCase();
  const badge    = experienceBadge(agent.completedMissions);
  const memberYear = new Date(agent.memberSince).getFullYear();

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Retour */}
      <Link href="/bailleur/agents" className="inline-flex items-center gap-1.5 text-sm text-sub hover:text-text transition-colors">
        <i className="fa-solid fa-arrow-left text-xs" />
        Tous les agents
      </Link>

      {/* Carte profil */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {agent.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.avatar}
              alt={`${agent.firstName} ${agent.lastName}`}
              className="h-20 w-20 rounded-2xl object-cover border border-line shrink-0"
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-gold-pale flex items-center justify-center text-2xl font-bold text-gold-dark shrink-0">
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-extrabold text-text">{agent.firstName} {agent.lastName}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-sub">Agent AlloVérifié · Membre depuis {memberYear}</p>

            {/* Stats rapides */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-shield-check text-emerald-500 text-sm" />
                <span className="text-sm font-bold text-text">{agent.completedMissions}</span>
                <span className="text-xs text-sub">mission{agent.completedMissions !== 1 ? 's' : ''}</span>
              </div>
              {agent.avgRating !== null && (
                <div className="flex items-center gap-1.5">
                  <Stars value={agent.avgRating} />
                  <span className="text-sm font-bold text-text">{agent.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-sub">({agent.totalRatings} avis)</span>
                </div>
              )}
            </div>

            {/* Contact */}
            {agent.phone && (
              <div className="flex items-center gap-3 mt-3">
                <a href={`tel:${agent.phone}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                  <i className="fa-solid fa-phone text-[10px]" />
                  {agent.phone}
                </a>
                <a href={`sms:${agent.phone}`} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 transition-colors">
                  <i className="fa-solid fa-message text-[10px]" />
                  SMS
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {agent.bio && (
          <div className="mt-5 pt-4 border-t border-line">
            <p className="text-[10px] font-semibold text-sub uppercase tracking-wide mb-1.5">À propos</p>
            <p className="text-sm text-text leading-relaxed">{agent.bio}</p>
          </div>
        )}

        {/* AlloVérifié badge */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gold-pale px-4 py-2.5">
          <i className="fa-solid fa-shield-halved text-gold-dark text-sm" />
          <p className="text-xs font-semibold text-gold-dark">Agent certifié AlloVérifié</p>
          <i className="fa-solid fa-circle-check text-emerald-500 text-xs ml-auto" />
        </div>
      </div>

      {/* Avis clients */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text">
            Avis clients
            {agent.totalRatings > 0 && (
              <span className="ml-2 text-sm font-normal text-sub">({agent.totalRatings})</span>
            )}
          </h2>
          {agent.avgRating !== null && (
            <div className="flex items-center gap-2">
              <Stars value={agent.avgRating} />
              <span className="text-lg font-extrabold text-text">{agent.avgRating.toFixed(1)}</span>
              <span className="text-xs text-sub">/5</span>
            </div>
          )}
        </div>

        {agent.ratings.length === 0 ? (
          <div className="text-center py-10">
            <i className="fa-solid fa-star text-3xl text-line mb-3" />
            <p className="text-sm text-sub">Aucun avis pour le moment</p>
            <p className="text-xs text-sub mt-1">Cet agent n'a pas encore reçu d'évaluation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Distribution étoiles */}
            <div className="space-y-1 mb-5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = agent.ratings.filter((r) => r.rating === star).length;
                const pct   = agent.totalRatings ? Math.round((count / agent.totalRatings) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-sub w-4 text-right">{star}</span>
                    <span className="text-amber-400 text-xs">★</span>
                    <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-sub w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Liste avis */}
            <div className="divide-y divide-line">
              {agent.ratings.map((r) => {
                const rInitials = `${r.raterFirstName[0]}${r.raterLastName[0]}`.toUpperCase();
                return (
                  <div key={r.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      {r.raterAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.raterAvatar} alt={r.raterFirstName}
                          className="h-8 w-8 rounded-full object-cover border border-line shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-bg border border-line flex items-center justify-center text-[10px] font-bold text-sub shrink-0">
                          {rInitials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs font-semibold text-text">{r.raterFirstName} {r.raterLastName[0]}.</p>
                          <p className="text-[10px] text-sub">{relativeTime(r.createdAt)}</p>
                        </div>
                        <Stars value={r.rating} />
                        {r.comment && (
                          <p className="text-xs text-text mt-1.5 leading-relaxed">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
