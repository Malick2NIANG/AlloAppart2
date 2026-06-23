'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

type ProfileChoice = 'bailleur_only' | 'dual';

const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, 'Numéro requis')
    .regex(/^\+?[0-9\s\-().]{7,20}$/, 'Format invalide (ex : +221 77 000 00 00)'),
});
type PhoneForm = z.infer<typeof phoneSchema>;

const variants = {
  enter:  (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir * -48, opacity: 0 }),
};

const STEPS = [
  { label: 'Profil',     icon: 'fa-user'           },
  { label: 'Téléphone',  icon: 'fa-phone'          },
  { label: 'Conditions', icon: 'fa-file-signature' },
];

const ENGAGEMENTS = [
  'Publier des annonces conformes à la réalité du bien',
  'Accepter la vérification physique AlloVérifié pour obtenir le badge',
  'Respecter les locataires et répondre aux demandes sous 48h',
  'Ne pas contourner la plateforme pour les transactions',
  'Accepter la commission de 0,5 mois de loyer à chaque signature de bail',
];

const inputCls =
  'w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition';

export default function BecomeBailleurPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [step,       setStep]       = useState(0);
  const [dir,        setDir]        = useState(1);
  const [profile,    setProfile]    = useState<ProfileChoice>('bailleur_only');
  const [loaded,     setLoaded]     = useState(false);
  const [phoneReady, setPhoneReady] = useState(false);
  const [accepted,   setAccepted]   = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
  });

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const me = await api.get<{ phone: string | null; roles: string[] }>('/auth/me', token);
        // Comptes pro/admin : redirigés vers leur propre espace — ils ne passent pas par ce flow
        if (me.roles.includes('BAILLEUR') || me.roles.includes('PRO_AGENCE')) {
          router.replace('/bailleur/listings');
          return;
        }
        if (me.roles.includes('ADMIN')) {
          router.replace('/espace');
          return;
        }
        if (me.roles.includes('AGENT_TERRAIN')) {
          router.replace('/agent/verifications');
          return;
        }
        setPhoneReady(!!me.phone);
      } catch { /* ignore */ }
      setLoaded(true);
    });
  }, [getToken, router]);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(null);
  };

  const handleProfileNext = () => go(phoneReady ? 2 : 1);

  const handlePhoneSubmit = async (data: PhoneForm) => {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Non authentifié');
      await api.patch('/auth/me', { phone: data.phone }, token);
      go(2);
    } catch {
      setError('Impossible de sauvegarder le numéro. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    if (!accepted) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Non authentifié');
      await api.patch('/auth/me/activate-bailleur', {}, token);
      router.push('/bailleur/listings');
      router.refresh();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Erreur lors de l'activation.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">

      {/* ── Stepper ── */}
      <div className="mb-8 flex items-center justify-center">
        {STEPS.map((s, i) => {
          const done   = i < step || (i === 1 && step === 2);
          const active = i === step;
          return (
            <div key={i} className="flex items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-gold text-gray-900 shadow-md'
                :          'border border-line bg-bg text-sub'
              }`}>
                {done ? <i className="fa-solid fa-check text-[10px]" /> : i + 1}
              </div>
              <span className={`ml-1.5 hidden text-xs font-medium sm:block ${active ? 'text-text' : 'text-sub'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px w-6 transition-all ${done ? 'bg-emerald-400' : 'bg-line'}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>

          {/* ── Step 0 : Profil ── */}
          {step === 0 && (
            <motion.div key="step0" custom={dir} variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22 }}>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale">
                  <i className="fa-solid fa-house-chimney text-xl text-gold-dark" />
                </div>
                <h1 className="text-xl font-extrabold text-text">Quel est votre profil ?</h1>
                <p className="mt-1 text-sm text-sub">Choisissez comment vous souhaitez utiliser Allo-Appart</p>
              </div>

              <div className="flex flex-col gap-3">
                {([
                  { val: 'bailleur_only' as const, icon: 'fa-house',      title: 'Bailleur uniquement',  sub: 'Je mets mon bien en location'      },
                  { val: 'dual'          as const, icon: 'fa-right-left', title: 'Bailleur & Locataire', sub: 'Je loue ET je cherche un logement' },
                ]).map(({ val, icon, title, sub }) => (
                  <button key={val} type="button" onClick={() => setProfile(val)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                      profile === val
                        ? 'border-gold bg-gold-pale ring-2 ring-gold/20'
                        : 'border-line bg-card hover:border-gold/40'
                    }`}>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      profile === val ? 'bg-gold/20' : 'border border-line bg-bg'
                    }`}>
                      <i className={`fa-solid ${icon} text-base ${profile === val ? 'text-gold-dark' : 'text-sub'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-text">{title}</p>
                      <p className="mt-0.5 text-xs text-sub">{sub}</p>
                    </div>
                    {profile === val && (
                      <i className="fa-solid fa-circle-check shrink-0 text-gold-dark" />
                    )}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-center text-xs text-sub">
                Dans les deux cas, vous gardez accès à toutes les fonctionnalités locataire
              </p>

              <button onClick={handleProfileNext}
                className="btn-gold mt-6 w-full justify-center rounded-full py-3 text-sm font-bold">
                Continuer <i className="fa-solid fa-arrow-right ml-1 text-xs" />
              </button>
            </motion.div>
          )}

          {/* ── Step 1 : Téléphone ── */}
          {step === 1 && (
            <motion.div key="step1" custom={dir} variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22 }}>

              <BackBtn onClick={() => go(0)} />

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale">
                  <i className="fa-solid fa-phone text-xl text-gold-dark" />
                </div>
                <h2 className="text-xl font-extrabold text-text">Votre numéro de téléphone</h2>
                <p className="mt-1 text-sm text-sub">Requis pour activer votre espace bailleur et être contacté</p>
              </div>

              {error && <ErrorBanner msg={error} />}

              <form onSubmit={handleSubmit(handlePhoneSubmit)} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Numéro international <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-sub" />
                    <input {...register('phone')} type="tel"
                      placeholder="+221 77 000 00 00"
                      className={`${inputCls} pl-10`} />
                  </div>
                  {errors.phone && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <i className="fa-solid fa-circle-exclamation" /> {errors.phone.message}
                    </p>
                  )}
                </div>
                <button type="submit" disabled={busy}
                  className="btn-gold w-full justify-center rounded-full py-3 text-sm font-bold disabled:opacity-50">
                  {busy
                    ? <><i className="fa-solid fa-spinner fa-spin" /> Enregistrement…</>
                    : <>Continuer <i className="fa-solid fa-arrow-right ml-1 text-xs" /></>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Step 2 : Conditions ── */}
          {step === 2 && (
            <motion.div key="step2" custom={dir} variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22 }}>

              <BackBtn onClick={() => go(phoneReady ? 0 : 1)} />

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-pale">
                  <i className="fa-solid fa-file-signature text-xl text-gold-dark" />
                </div>
                <h2 className="text-xl font-extrabold text-text">Avant de continuer</h2>
                <p className="mt-1 text-sm text-sub">Prenez connaissance de vos engagements en tant que bailleur</p>
              </div>

              <div className="mb-5 rounded-2xl border border-line bg-card p-5">
                <ul className="space-y-3">
                  {ENGAGEMENTS.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-text">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-pale text-[10px] font-bold text-gold-dark">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {error && <ErrorBanner msg={error} />}

              <label className="mb-5 flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-gold)" />
                <span className="text-sm text-text">
                  J'accepte les{' '}
                  <span className="font-semibold text-gold-dark">conditions bailleurs</span>{' '}
                  d'Allo-Appart
                </span>
              </label>

              <button onClick={handleActivate}
                disabled={!accepted || busy}
                className="btn-gold w-full justify-center rounded-full py-3 text-sm font-bold disabled:opacity-50">
                {busy
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Activation…</>
                  : <><i className="fa-solid fa-house-chimney-user" /> Activer mon espace bailleur</>}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="mb-5 flex items-center gap-2 text-sm text-sub transition hover:text-text">
      <i className="fa-solid fa-arrow-left text-xs" /> Retour
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      <i className="fa-solid fa-circle-exclamation shrink-0" /> {msg}
    </div>
  );
}
