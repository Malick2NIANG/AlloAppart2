'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  completedMissions: number;
}

/* ── Agent card ──────────────────────────────────────────────────────────── */

function AgentCard({ agent }: { agent: Agent }) {
  const t = useTranslations('bailleur');
  const initials = [agent.firstName?.[0], agent.lastName?.[0]].filter(Boolean).join('').toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-line shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {agent.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.avatar}
            alt={`${agent.firstName} ${agent.lastName}`}
            className="h-14 w-14 rounded-full object-cover border border-line flex-shrink-0"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-gold">{initials}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-text text-base leading-snug truncate">
            {agent.firstName} {agent.lastName}
          </p>
          <p className="text-xs text-sub mt-0.5">{t('agentVerifiedBadge')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-xl font-bold text-emerald-600">{agent.completedMissions}</p>
          <p className="text-[10px] text-emerald-700 mt-0.5 leading-tight">
            {t('agentMission', { count: agent.completedMissions })}
          </p>
        </div>
        <div className="flex-1 bg-gold/5 rounded-xl p-3 text-center border border-gold/20">
          <p className="text-xl font-bold text-gold">
            <i className="fa-solid fa-shield-halved text-lg" />
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">{t('agentCertified')}</p>
        </div>
      </div>

      {/* Bio */}
      {agent.bio && (
        <p className="text-xs text-sub leading-relaxed line-clamp-3">
          {agent.bio}
        </p>
      )}

      {/* Contact */}
      {agent.phone && (
        <a
          href={`tel:${agent.phone}`}
          className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors"
        >
          <i className="fa-solid fa-phone text-[10px]" />
          {agent.phone}
        </a>
      )}

      {/* Badge expérience + lien profil */}
      <div className="mt-auto pt-3 border-t border-line flex items-center justify-between gap-2">
        {agent.completedMissions >= 10 ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            <i className="fa-solid fa-star text-[9px] text-amber-500" />
            {t('agentExperienced')}
          </span>
        ) : agent.completedMissions >= 3 ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
            <i className="fa-solid fa-circle-check text-[9px] text-blue-500" />
            {t('agentActiveLabel')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <i className="fa-solid fa-seedling text-[9px] text-emerald-500" />
            {t('agentNew')}
          </span>
        )}
        <Link
          href={`/bailleur/agents/${agent.id}`}
          className="text-[11px] text-gold-dark hover:underline flex items-center gap-1 shrink-0"
        >
          {t('agentViewProfile')}
          <i className="fa-solid fa-arrow-right text-[9px]" />
        </Link>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function BailleurAgentsPage() {
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');

  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<Agent[]>('/auth/agents', token);
      setAgents(data);
    } catch {
      // non-blocking error
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">{t('agentsTitle')}</h1>
        <p className="text-sm text-sub mt-1">{t('agentsSubtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sub text-xs" />
        <input
          type="text"
          placeholder={t('agentSearchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-line rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 text-text placeholder:text-sub"
        />
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">{t('agentInfoNote')}</p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-line p-5 animate-pulse space-y-4">
              <div className="flex gap-3 items-center">
                <div className="h-14 w-14 rounded-full bg-line" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-line rounded w-3/4" />
                  <div className="h-3 bg-line rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 h-16 bg-line rounded-xl" />
                <div className="flex-1 h-16 bg-line rounded-xl" />
              </div>
              <div className="h-3 bg-line rounded w-full" />
              <div className="h-3 bg-line rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <i className="fa-solid fa-user-slash text-4xl text-line mb-4" />
          <p className="text-sub text-sm">
            {search ? t('agentNoResults') : t('agentNone')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

    </div>
  );
}
