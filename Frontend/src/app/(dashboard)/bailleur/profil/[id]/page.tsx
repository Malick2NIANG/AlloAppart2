'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';

const ROLE_COLORS: Record<string, string> = {
  LOCATAIRE:     'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  BAILLEUR:      'bg-gold-pale text-gold-dark',
  PRO_AGENCE:    'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
  AGENT_TERRAIN: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
  ADMIN:         'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
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
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-line rounded-2xl" />
        <div className="h-24 bg-line rounded-2xl" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <i className="fa-solid fa-user-slash text-4xl text-line mb-4" />
        <p className="text-sub">{error || t('profilNotFound')}</p>
        <button onClick={() => router.back()} className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-dark hover:underline">
          <i className="fa-solid fa-arrow-left text-xs" />
          {t('profilBack')}
        </button>
      </div>
    );
  }

  const initials   = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const fullName   = `${user.firstName} ${user.lastName}`.trim();
  const memberSince = new Date(user.createdAt).toLocaleDateString(numLocale, { month: 'long', year: 'numeric' });
  const isAgent    = user.roles.includes('AGENT_TERRAIN');

  return (
    <div className="space-y-5">

      {/* Back — revient à la page d'origine (ex. la discussion où "Voir le
          profil" a été cliqué), pas systématiquement à une liste. */}
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-sub hover:text-text transition-colors">
        <i className="fa-solid fa-arrow-left text-xs" />
        {t('profilBack')}
      </button>

      {/* Profile card */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={fullName}
              className="h-20 w-20 rounded-2xl object-cover border border-line shrink-0"
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-gold-pale flex items-center justify-center text-2xl font-bold text-gold-dark shrink-0">
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-extrabold text-text">{fullName}</h1>
            </div>
            {user.agencyName && (
              <p className="text-xs text-sub">
                <i className="fa-solid fa-building text-[10px] mr-1 text-gold-dark/60" />
                {user.agencyName}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.roles.map((role) => (
                <span key={role} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-100 dark:bg-gray-950/40 text-gray-600 dark:text-gray-400'}`}>
                  {ROLE_LABELS[role] ?? role}
                </span>
              ))}
            </div>

            {/* Info — pas de téléphone ici : tout contact direct doit passer
                par la messagerie interne (anti-contournement, cf. Article 12
                des CGU et Task #123/#124). Même si le backend le renvoie pour
                un viewer qualifiant, cette page ne l'affiche volontairement
                jamais. */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-sub">
                <i className="fa-regular fa-calendar text-[10px] text-gold-dark/60" />
                {t('profilMemberSince', { date: memberSince })}
              </div>
              <Link href="/bailleur/messages" className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                <i className="fa-solid fa-message text-[10px]" />
                {t('profilContactViaMessaging')}
              </Link>
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <div className="mt-5 pt-4 border-t border-line">
            <p className="text-sm text-text leading-relaxed">{user.bio}</p>
          </div>
        )}

        {/* CTA agent */}
        {isAgent && (
          <div className="mt-4">
            <Link
              href={`/bailleur/agents/${user.id}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-gold-pale text-gold-dark text-sm font-semibold py-2.5 hover:bg-gold/20 transition-colors"
            >
              <i className="fa-solid fa-shield-halved text-xs" />
              {t('profilAgentCta')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
