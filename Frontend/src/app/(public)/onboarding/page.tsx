'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth, useUser } from '@clerk/nextjs';
import { api } from '@/lib/api';

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations('onboarding');
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ROLES = [
    { key: 'LOCATAIRE', icon: 'fa-key',           title: t('locataireTitle'), desc: t('locataireDesc'), badge: t('locataireBadge') },
    { key: 'BAILLEUR',  icon: 'fa-house-chimney',  title: t('bailleurTitle'),  desc: t('bailleurDesc'),  badge: t('bailleurBadge')  },
  ];

  const toggle = (key: string) =>
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const confirm = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();

      // 1. Sync/créer l'utilisateur en base via le guard auto-create
      //    Un simple appel authentifié suffit ; on appelle GET /auth/me pour déclencher l'upsert
      await api.get('/auth/me', token ?? undefined).catch(() => {
        // Si le user n'existe pas encore, le guard le crée — l'erreur est ignorée
      });

      // 2. Si bailleur sélectionné, activer le rôle
      if (selected.includes('BAILLEUR')) {
        await api.patch('/auth/me/activate-bailleur', {}, token ?? undefined);
      }

      // 3. Persister localement pour le mode demo/hybride
      localStorage.setItem('aa_user_roles', JSON.stringify(selected));

      router.push('/espace');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(t('error'));
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-lg">

        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
            <i className="fa-solid fa-rocket text-2xl text-gold-dark" />
          </div>
          <h1 className="text-2xl font-extrabold text-text">{t('title')}</h1>
          <p className="mt-2 text-sm text-sub">{t('subtitle')}</p>
          {clerkUser && (
            <p className="mt-1 text-sm font-medium text-gold-dark">
              {clerkUser.firstName} {clerkUser.lastName}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {ROLES.map((r) => {
            const isActive = selected.includes(r.key);
            return (
              <button key={r.key} onClick={() => toggle(r.key)}
                className={`w-full rounded-2xl border p-5 text-left transition-all ${
                  isActive ? 'border-gold bg-gold-pale ring-2 ring-gold/30' : 'border-line bg-card hover:border-gold/40'
                }`}>
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'bg-gold text-gray-900' : 'bg-bg text-sub'
                  }`}>
                    <i className={`fa-solid ${r.icon} text-lg`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-text">{r.title}</span>
                      <span className="rounded-full border border-line bg-bg px-2 py-0.5 text-[10px] font-semibold text-sub">
                        {r.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-sub">{r.desc}</p>
                  </div>
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    isActive ? 'border-gold bg-gold' : 'border-line bg-bg'
                  }`}>
                    {isActive && <i className="fa-solid fa-check text-[9px] text-gray-900" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-red-600">
            <i className="fa-solid fa-circle-exclamation text-xs" />
            {error}
          </p>
        )}

        <button onClick={confirm} disabled={selected.length === 0 || loading}
          className="mt-8 w-full rounded-full bg-gold py-3 text-sm font-bold text-gray-900 hover:bg-gold-dark hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading
            ? <><i className="fa-solid fa-spinner fa-spin" /> {t('ctaLoading')}</>
            : <><i className="fa-solid fa-arrow-right" /> {t('cta')}</>
          }
        </button>

        <p className="mt-4 text-center text-xs text-sub">
          {t('note')}{' '}
          <a href="/profil" className="text-gold-dark hover:underline">Profil</a>.
        </p>
      </div>
    </main>
  );
}
