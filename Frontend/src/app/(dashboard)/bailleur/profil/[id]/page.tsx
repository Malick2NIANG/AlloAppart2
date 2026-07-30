'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';

const ROLE_COLORS: Record<string, string> = {
  LOCATAIRE:     'bg-blue-50 text-blue-700',
  BAILLEUR:      'bg-gold-pale text-gold-dark',
  PRO_AGENCE:    'bg-purple-50 text-purple-700',
  AGENT_TERRAIN: 'bg-emerald-50 text-emerald-700',
  ADMIN:         'bg-red-50 text-red-700',
};

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  roles: string[];
  agencyName: string | null;
  createdAt: string;
}

export default function ProfilPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const t = useTranslations('bailleur');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  const [user, setUser]       = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const ROLE_LABELS = useMemo<Record<string, string>>(() => ({
    LOCATAIRE:     t('roleLocataire'),
    BAILLEUR:      t('roleBailleur'),
    PRO_AGENCE:    t('roleProAgence'),
    AGENT_TERRAIN: t('roleAgentTerrain'),
    ADMIN:         t('roleAdmin'),
  }), [t]);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        const data = await api.get<UserProfile>(`/auth/profile/${id}`, token ?? undefined);
        setUser(data);
      } catch {
        setError(t('profilNotFound'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, getToken, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-user-slash text-2xl text-red-400" />
        </div>
        <p className="font-semibold text-text">{error ?? t('profilNotFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-gold-dark hover:underline">
          ← {t('profilBack')}
        </button>
      </div>
    );
  }

  const initials   = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const fullName   = `${user.firstName} ${user.lastName}`.trim();
  const memberSince = new Date(user.createdAt).toLocaleDateString(numLocale, { month: 'long', year: 'numeric' });
  const isAgent    = user.roles.includes('AGENT_TERRAIN');

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-sub hover:text-text transition-colors mb-6">
        <i className="fa-solid fa-arrow-left text-xs" /> {t('profilBack')}
      </button>

      <div className="rounded-2xl border border-line bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="h-24 bg-gradient-to-r from-gold-pale to-gold/20" />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-12 mb-4">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt={fullName}
                className="h-20 w-20 rounded-2xl object-cover border-4 border-card shadow-sm"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gold-pale flex items-center justify-center text-xl font-bold text-gold-dark border-4 border-card shadow-sm">
                {initials}
              </div>
            )}
          </div>

          {/* Name + roles */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-text">{fullName}</h1>
            {user.agencyName && (
              <p className="text-sm text-sub mt-0.5">
                <i className="fa-solid fa-building text-[10px] mr-1 text-gold-dark/60" />
                {user.agencyName}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.roles.map((role) => (
                <span key={role} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ROLE_LABELS[role] ?? role}
                </span>
              ))}
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mb-4">
              <p className="text-sm text-text leading-relaxed">{user.bio}</p>
            </div>
          )}

          {/* Info */}
          <div className="space-y-2.5 border-t border-line pt-4">
            <div className="flex items-center gap-3 text-sm text-sub">
              <i className="fa-regular fa-calendar w-4 text-center text-gold-dark/60" />
              {t('profilMemberSince', { date: memberSince })}
            </div>
            {user.phone && (
              <div className="flex items-center gap-3 text-sm text-sub">
                <i className="fa-solid fa-phone w-4 text-center text-gold-dark/60" />
                <a href={`tel:${user.phone}`} className="text-blue-600 hover:text-blue-700 transition-colors">
                  {user.phone}
                </a>
              </div>
            )}
          </div>

          {/* CTA agent */}
          {isAgent && (
            <div className="mt-5">
              <a
                href={`/bailleur/agents/${user.id}`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-gold-pale text-gold-dark text-sm font-semibold py-2.5 hover:bg-gold/20 transition-colors"
              >
                <i className="fa-solid fa-shield-halved text-xs" />
                {t('profilAgentCta')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
