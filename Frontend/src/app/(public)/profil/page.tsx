'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

const DEMO_USERS: Record<Exclude<DemoRole, 'visitor'>, { name: string; firstName: string; lastName: string; email: string; initials: string; role: string }> = {
  locataire: { name: 'Mamadou Diallo', firstName: 'Mamadou', lastName: 'Diallo',  email: 'mamadou@demo.sn', initials: 'MD', role: 'Locataire'              },
  bailleur:  { name: 'Binta Sarr',     firstName: 'Binta',   lastName: 'Sarr',    email: 'binta@demo.sn',   initials: 'BS', role: 'Bailleur'               },
  dual:      { name: 'Ousmane Thiaw',  firstName: 'Ousmane', lastName: 'Thiaw',   email: 'ousmane@demo.sn', initials: 'OT', role: 'Locataire + Bailleur'   },
  admin:     { name: 'Modou Kane',     firstName: 'Modou',   lastName: 'Kane',    email: 'admin@demo.sn',   initials: 'MK', role: 'Administrateur'         },
  agent:     { name: 'Awa Diop',       firstName: 'Awa',     lastName: 'Diop',    email: 'agent@demo.sn',   initials: 'AD', role: 'Agent vérificateur'     },
};

export default function ProfilPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const t = useTranslations('profil');

  const [demoRole, setDemoRole] = useState<DemoRole>('visitor');
  const [mounted, setMounted]   = useState(false);

  /* form state */
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aa_demo_role') as DemoRole | null;
    if (stored && ['visitor', 'locataire', 'bailleur', 'dual', 'admin', 'agent'].includes(stored)) setDemoRole(stored);
    setMounted(true);
    const handler = (e: Event) => setDemoRole((e as CustomEvent<DemoRole>).detail);
    window.addEventListener('aa-demo-change', handler);
    return () => window.removeEventListener('aa-demo-change', handler);
  }, []);

  /* Populate form once user is known */
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setPhone(user.phoneNumbers?.[0]?.phoneNumber ?? '');
    } else if (mounted && !isSignedIn && demoRole !== 'visitor') {
      const d = DEMO_USERS[demoRole as Exclude<DemoRole, 'visitor'>];
      setFirstName(d.firstName);
      setLastName(d.lastName);
    }
  }, [user, mounted, isSignedIn, demoRole]);

  if (!mounted) return null;

  const effectiveSignedIn = isSignedIn || demoRole !== 'visitor';
  const isDemo = !isSignedIn && demoRole !== 'visitor';
  const demoData = isDemo ? DEMO_USERS[demoRole as Exclude<DemoRole, 'visitor'>] : null;

  const displayName  = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : demoData?.name ?? '';
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress ?? demoData?.email ?? '';
  const initials     = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : demoData?.initials ?? '?';

  if (!effectiveSignedIn) {
    return (
      <main className="py-16 px-4 bg-bg min-h-screen">
        <div className="aa-container max-w-2xl text-center">
          <p className="text-sub text-sm">{t('signInRequired')}</p>
          <Link href="/sign-in" className="btn-gold mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
            {t('signIn')}
          </Link>
        </div>
      </main>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) return;
    setSaving(true);
    try {
      const token = await getToken().catch(() => null);
      await Promise.all([
        user?.update({ firstName, lastName }),
        token
          ? fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/me`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ firstName, lastName, phone: phone || null }),
            }).catch(() => null)
          : null,
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-2xl">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/espace" className="hover:text-gold-dark transition-colors">{t('mySpace')}</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('title')}</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale text-2xl font-extrabold text-gold-dark ring-4 ring-gold/20">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-text">{displayName || t('title')}</h1>
            <p className="text-sm text-sub">{displayEmail}</p>
            {isDemo && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <i className="fa-solid fa-flask text-[9px]" /> {t('demoMode')}
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="rounded-2xl border border-line bg-card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <i className="fa-solid fa-user-circle text-gold-dark" /> {t('personalInfo')}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('firstName')}>
              <input
                type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                disabled={isDemo || !isLoaded}
                className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </Field>
            <Field label={t('lastName')}>
              <input
                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                disabled={isDemo || !isLoaded}
                className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </Field>
          </div>

          <Field label={t('email')}>
            <input
              type="email" value={displayEmail} readOnly
              className="input-field opacity-60 cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-sub">{t('emailNote')}</p>
          </Field>

          <Field label={t('phone')}>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 000 00 00"
              disabled={isDemo || !isLoaded}
              className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </Field>

          {!isDemo && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit" disabled={saving}
                className="btn-gold rounded-full px-6 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin" /> {t('saving')}</>
                  : <><i className="fa-solid fa-floppy-disk" /> {t('save')}</>
                }
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <i className="fa-solid fa-circle-check" /> {t('saved')}
                </span>
              )}
            </div>
          )}

          {isDemo && (
            <p className="text-xs text-sub italic">{t('demoReadOnly')}</p>
          )}
        </form>

        {/* Security link */}
        <Link
          href="/profil/securite"
          className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-4 hover:border-gold/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-pale">
              <i className="fa-solid fa-shield-halved text-gold-dark" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{t('securityTitle')}</p>
              <p className="text-xs text-sub">{t('securityDesc')}</p>
            </div>
          </div>
          <i className="fa-solid fa-chevron-right text-sub text-xs group-hover:text-gold-dark transition-colors" />
        </Link>

      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-sub uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
