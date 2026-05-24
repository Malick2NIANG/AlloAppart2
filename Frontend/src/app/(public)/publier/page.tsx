'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

/* ── Constants ───────────────────────────────────────────────────────── */

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;

const SENEGAL_REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
  'Fatick', 'Kolda', 'Tambacounda', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou', 'Louga', 'Diourbel',
];

const AMENITIES = [
  { key: 'wifi',        icon: 'fa-wifi',          label: 'Wi-Fi'             },
  { key: 'clim',        icon: 'fa-snowflake',      label: 'Climatisation'     },
  { key: 'tv',          icon: 'fa-tv',             label: 'Télévision'        },
  { key: 'cuisine',     icon: 'fa-utensils',       label: 'Cuisine équipée'   },
  { key: 'douche',      icon: 'fa-shower',         label: 'Douche / SdB'      },
  { key: 'gardien',     icon: 'fa-shield-halved',  label: 'Gardiennage'       },
  { key: 'parking',     icon: 'fa-car',            label: 'Parking'           },
  { key: 'piscine',     icon: 'fa-water',          label: 'Piscine'           },
  { key: 'balcon',      icon: 'fa-door-open',      label: 'Balcon / Terrasse' },
  { key: 'generateur',  icon: 'fa-bolt',           label: 'Générateur'        },
];

const TYPE_META: Record<string, { icon: string; label: string }> = {
  APPARTEMENT: { icon: 'fa-building',       label: 'Appartement' },
  VILLA:       { icon: 'fa-house-chimney',  label: 'Villa'       },
  STUDIO:      { icon: 'fa-door-open',      label: 'Studio'      },
  CHAMBRE:     { icon: 'fa-bed',            label: 'Chambre'     },
  BUREAU:      { icon: 'fa-briefcase',      label: 'Bureau'      },
};

const STEP_META = [
  { icon: 'fa-tag',          label: 'Type & Titre'     },
  { icon: 'fa-list-check',   label: 'Caractéristiques' },
  { icon: 'fa-location-dot', label: 'Localisation'     },
  { icon: 'fa-coins',        label: 'Prix'             },
  { icon: 'fa-images',       label: 'Photos'           },
  { icon: 'fa-eye',          label: 'Récapitulatif'    },
];

const TOTAL_STEPS = 5; // indices 0-4, recap at 5

/* ── Zod schema ──────────────────────────────────────────────────────── */

const schema = z.object({
  type:        z.enum(LISTING_TYPES),
  title:       z.string().min(5,  'Titre trop court (5 caractères min)'),
  description: z.string().min(20, 'Description trop courte (20 caractères min)'),
  surface:     z.number().positive().optional(),
  rooms:       z.number().int().min(0).optional(),
  beds:        z.number().int().min(0).optional(),
  baths:       z.number().int().min(0).optional(),
  amenities:   z.array(z.string()).default([]),
  region:      z.string().min(2, 'Région requise'),
  city:        z.string().min(2, 'Ville requise'),
  address:     z.string().min(5, 'Adresse requise'),
  lat:         z.number(),
  lng:         z.number(),
  price:       z.number().positive('Loyer requis (> 0)'),
  images:      z.array(z.string()).min(1, 'Au moins une photo requise'),
});

type FormValues = z.infer<typeof schema>;

/* Champs validés par étape */
const STEP_FIELDS: (keyof FormValues)[][] = [
  ['type', 'title', 'description'],
  ['surface', 'rooms', 'beds', 'baths', 'amenities'],
  ['region', 'city', 'address', 'lat', 'lng'],
  ['price'],
  ['images'],
];

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

const DRAFT_KEY = 'aa_listing_draft';

/* ── Page principale ─────────────────────────────────────────────────── */

export default function PublierPage() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [step,          setStep]          = useState(0);
  const [demoRole,      setDemoRole]      = useState<DemoRole>('visitor');
  const [mounted,       setMounted]       = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [apiError,      setApiError]      = useState<string | null>(null);
  const [userRoles,     setUserRoles]     = useState<string[]>([]);
  const [rolesLoaded,   setRolesLoaded]   = useState(false);
  const [activating,    setActivating]    = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, trigger,
    formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      type: 'APPARTEMENT',
      amenities: [],
      images: [],
      lat: 14.6937,
      lng: -17.4441,
    },
  });

  useEffect(() => {
    // Restore draft saved from a previous session
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<FormValues>;
        (Object.entries(draft) as [keyof FormValues, FormValues[keyof FormValues]][]).forEach(
          ([key, val]) => setValue(key, val),
        );
      }
    } catch {}

    if (process.env.NODE_ENV !== 'production') {
      const stored = localStorage.getItem('aa_demo_role') as DemoRole | null;
      if (stored && ['visitor','locataire','bailleur','dual','admin','agent'].includes(stored)) setDemoRole(stored);
      const handler = (e: Event) => setDemoRole((e as CustomEvent<DemoRole>).detail);
      window.addEventListener('aa-demo-change', handler);
      setMounted(true);
      return () => window.removeEventListener('aa-demo-change', handler);
    }
    setMounted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Récupère les rôles réels dès que l'utilisateur est connecté
  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const { api } = await import('@/lib/api');
        const me = await api.get<{ roles: string[] }>('/auth/me', token);
        setUserRoles(me.roles);
      } catch {
        setUserRoles([]);
      } finally {
        setRolesLoaded(true);
      }
    });
  }, [isSignedIn, getToken]);

  const activateBailleur = async () => {
    setActivating(true);
    setActivateError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Non authentifié');
      const { api } = await import('@/lib/api');
      const updated = await api.patch<{ roles: string[] }>('/auth/me/activate-bailleur', {}, token);
      setUserRoles(updated.roles);
    } catch {
      setActivateError('Impossible d\'activer le rôle. Réessaie.');
    } finally {
      setActivating(false);
    }
  };

  const values    = watch();
  const isDemo    = !isSignedIn && demoRole !== 'visitor';
  const canAccess = isSignedIn || demoRole !== 'visitor';
  const isBailleur = isDemo || userRoles.some((r) => ['BAILLEUR', 'PRO_AGENCE', 'ADMIN'].includes(r));

  if (!mounted) return null;

  /* ── Visiteur non connecté ── */
  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
            <i className="fa-solid fa-house-chimney text-2xl text-gold-dark" />
          </div>
          <h1 className="text-xl font-extrabold text-text">Publier une annonce</h1>
          <p className="mt-2 text-sm text-sub">Connectez-vous pour déposer votre annonce gratuitement.</p>
          <Link href="/sign-in" className="btn-gold mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
            <i className="fa-solid fa-arrow-right-to-bracket" /> Se connecter
          </Link>
        </div>
      </main>
    );
  }

  /* ── Chargement des rôles ── */
  if (isSignedIn && !rolesLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </main>
    );
  }

  /* ── Utilisateur connecté mais LOCATAIRE seulement ── */
  if (isSignedIn && !isBailleur) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
            <i className="fa-solid fa-key text-2xl text-gold-dark" />
          </div>
          <h1 className="text-xl font-extrabold text-text">Devenir bailleur</h1>
          <p className="mt-2 text-sm text-sub">
            Pour publier des annonces, activez votre rôle Bailleur. C&apos;est gratuit et instantané.
          </p>
          <ul className="mt-5 space-y-2 text-left text-sm text-sub">
            {[
              'Publiez vos annonces de location',
              'Gérez vos réservations',
              'Recevez vos paiements en sécurité',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-gold-dark text-xs" /> {item}
              </li>
            ))}
          </ul>
          {activateError && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-red-500">
              <i className="fa-solid fa-circle-exclamation" /> {activateError}
            </p>
          )}
          <button
            onClick={activateBailleur}
            disabled={activating}
            className="btn-gold mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {activating
              ? <><i className="fa-solid fa-spinner fa-spin text-xs" /> Activation…</>
              : <><i className="fa-solid fa-house-chimney-user text-xs" /> Activer le rôle Bailleur</>
            }
          </button>
          <Link href="/espace"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-sub hover:text-gold-dark transition-colors">
            <i className="fa-solid fa-arrow-left text-[10px]" /> Retour à mon espace
          </Link>
        </div>
      </main>
    );
  }

  /* ── Succès ── */
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <i className="fa-solid fa-circle-check text-2xl text-emerald-600" />
          </div>
          <h1 className="text-xl font-extrabold text-text">
            {isDemo ? 'Simulation réussie !' : 'Annonce publiée !'}
          </h1>
          <p className="mt-2 text-sm text-sub">
            {isDemo
              ? 'En mode démo, l\'annonce n\'est pas enregistrée. Créez un compte pour publier.'
              : 'Votre annonce est en cours de validation. Nos agents vous contacteront prochainement.'}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/espace" className="btn-gold inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
              <i className="fa-solid fa-house-chimney" /> Mon espace
            </Link>
            <button onClick={() => { localStorage.removeItem(DRAFT_KEY); setSuccess(false); setStep(0); }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all">
              <i className="fa-solid fa-plus" /> Publier une autre annonce
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Avancement étape ── */
  const advance = async () => {
    // En mode démo, step 4 (photos) est verrouillé : on passe directement
    const valid = (isDemo && step === 4) ? true : await trigger(STEP_FIELDS[step]);
    if (valid) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      setStep((s) => s + 1);
    }
  };

  /* ── Soumission finale ── */
  const onSubmit = async (data: FormValues) => {
    setApiError(null);
    if (isDemo) { setSuccess(true); return; }
    try {
      const token = await getToken();
      await api.post('/listings', data, token ?? undefined);
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(true);
    } catch (err: unknown) {
      setApiError((err as Error)?.message ?? 'Une erreur est survenue.');
    }
  };

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-2xl">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/espace" className="hover:text-gold-dark transition-colors">Mon espace</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">Publier une annonce</span>
        </nav>

        <h1 className="mb-6 flex items-center gap-2 text-xl font-extrabold text-text">
          <i className="fa-solid fa-circle-plus text-gold-dark" /> Publier une annonce
        </h1>

        {/* Bannière démo */}
        {isDemo && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <i className="fa-solid fa-flask shrink-0" />
            Mode démo — votre annonce ne sera pas enregistrée.
          </div>
        )}

        {/* Indicateur d'étapes */}
        <StepIndicator current={step} />

        {/* Formulaire */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mt-8 rounded-2xl border border-line bg-card p-6 space-y-6">

            {/* ── Étape 0 : Type & Titre ── */}
            {step === 0 && (
              <>
                <StepHeader title="Type & Titre" sub="De quel type de bien s'agit-il ?" />

                <div>
                  <FieldLabel label="Type de bien" required />
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {LISTING_TYPES.map((t) => {
                      const active = values.type === t;
                      const meta   = TYPE_META[t];
                      return (
                        <button key={t} type="button" onClick={() => setValue('type', t)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                            active ? 'border-gold bg-gold-pale ring-2 ring-gold/30' : 'border-line bg-bg hover:border-gold/40'
                          }`}>
                          <i className={`fa-solid ${meta.icon} text-xl ${active ? 'text-gold-dark' : 'text-sub'}`} />
                          <span className={`text-[11px] font-semibold ${active ? 'text-gold-dark' : 'text-sub'}`}>
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="Titre de l'annonce" error={errors.title?.message} required>
                  <input {...register('title')}
                    placeholder="Ex : Appartement 3 pièces meublé au Plateau"
                    className="input-field" />
                </Field>

                <Field label="Description" error={errors.description?.message} required>
                  <textarea {...register('description')} rows={5}
                    placeholder="Décrivez votre bien en détail : luminosité, état, proximité services, transports…"
                    className="input-field resize-none" />
                  <p className="mt-1 text-right text-[11px] text-sub">
                    {(values.description || '').length} car. (20 min)
                  </p>
                </Field>
              </>
            )}

            {/* ── Étape 1 : Caractéristiques ── */}
            {step === 1 && (
              <>
                <StepHeader title="Caractéristiques" sub="Surface, pièces et équipements" />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {([
                    { key: 'surface' as const, label: 'Surface (m²)',  ph: '85' },
                    { key: 'rooms'   as const, label: 'Pièces',        ph: '3'  },
                    { key: 'beds'    as const, label: 'Chambres',      ph: '2'  },
                    { key: 'baths'   as const, label: 'Salle(s) de bain', ph: '1' },
                  ]).map(({ key, label, ph }) => (
                    <Field key={key} label={label}>
                      <input type="number" min={0} {...register(key, { valueAsNumber: true })} placeholder={ph} className="input-field" />
                    </Field>
                  ))}
                </div>

                <div>
                  <FieldLabel label="Équipements" />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {AMENITIES.map(({ key, icon, label }) => {
                      const active = (values.amenities || []).includes(key);
                      return (
                        <button key={key} type="button"
                          onClick={() => {
                            const cur = values.amenities || [];
                            setValue('amenities', active ? cur.filter((a) => a !== key) : [...cur, key]);
                          }}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                            active ? 'border-gold bg-gold-pale text-gold-dark' : 'border-line bg-bg text-sub hover:border-gold/40'
                          }`}>
                          <i className={`fa-solid ${icon} text-sm shrink-0`} />
                          <span className="font-medium">{label}</span>
                          {active && <i className="fa-solid fa-check ml-auto text-[10px]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── Étape 2 : Localisation ── */}
            {step === 2 && (
              <>
                <StepHeader title="Localisation" sub="Où se trouve votre bien ?" />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Région" error={errors.region?.message} required>
                    <select {...register('region')} className="input-field">
                      <option value="">— Choisir une région —</option>
                      {SENEGAL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Ville / Quartier" error={errors.city?.message} required>
                    <input {...register('city')} placeholder="Ex : Plateau, Dakar" className="input-field" />
                  </Field>
                </div>

                <Field label="Adresse complète" error={errors.address?.message} required>
                  <input {...register('address')} placeholder="Rue, numéro, résidence…" className="input-field" />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Latitude GPS" error={errors.lat?.message}>
                    <input type="number" step="any" {...register('lat', { valueAsNumber: true })} className="input-field" />
                  </Field>
                  <Field label="Longitude GPS" error={errors.lng?.message}>
                    <input type="number" step="any" {...register('lng', { valueAsNumber: true })} className="input-field" />
                  </Field>
                </div>
                <p className="text-xs text-sub">
                  <i className="fa-solid fa-circle-info mr-1 text-gold-dark" />
                  Coordonnées pré-remplies sur Dakar. Modifiez si votre bien est ailleurs.
                </p>
              </>
            )}

            {/* ── Étape 3 : Prix ── */}
            {step === 3 && (
              <>
                <StepHeader title="Prix" sub="Quel est le loyer mensuel demandé ?" />

                <Field label="Loyer mensuel (FCFA)" error={errors.price?.message} required>
                  <div className="relative">
                    <input type="number" min={0} {...register('price', { valueAsNumber: true })}
                      placeholder="Ex : 350 000"
                      className="input-field pr-16" />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-sub">
                      FCFA
                    </span>
                  </div>
                </Field>

                {Number(values.price) > 0 && (
                  <div className="rounded-2xl border border-gold/30 bg-gold-pale px-5 py-4">
                    <p className="text-xs text-sub mb-1">Loyer mensuel</p>
                    <p className="text-3xl font-extrabold text-gold-dark">
                      {Number(values.price).toLocaleString('fr-SN')}
                      <span className="ml-2 text-base font-semibold text-sub">FCFA / mois</span>
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Étape 4 : Photos ── */}
            {step === 4 && (
              <>
                <StepHeader title="Photos" sub="Ajoutez au moins une photo de votre bien (jpg, png, webp — 8 Mo max)" />
                {isDemo ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 px-6 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                      <i className="fa-solid fa-lock text-xl text-amber-600" />
                    </div>
                    <p className="text-sm font-semibold text-amber-700">Upload désactivé en mode démo</p>
                    <p className="text-xs text-amber-600 max-w-xs">
                      Créez un compte pour uploader de vraies photos. En mode démo l&apos;annonce ne sera pas enregistrée.
                    </p>
                    <a href="/sign-up"
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-500 text-white px-5 py-2 text-xs font-semibold hover:bg-amber-600 transition-colors">
                      <i className="fa-solid fa-user-plus text-xs" /> Créer un compte
                    </a>
                  </div>
                ) : (
                  <ImageUploadZone
                    images={values.images || []}
                    onChange={(imgs) => setValue('images', imgs, { shouldValidate: true })}
                    getToken={getToken}
                  />
                )}
                {!isDemo && errors.images && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500">
                    <i className="fa-solid fa-circle-exclamation" /> Au moins une photo est requise
                  </p>
                )}
              </>
            )}

            {/* ── Étape 5 : Récapitulatif ── */}
            {step === 5 && (
              <>
                <StepHeader title="Récapitulatif" sub="Vérifiez les informations avant de publier" />
                <RecapCard values={values} />
                {apiError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <i className="fa-solid fa-circle-exclamation shrink-0" /> {apiError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation bas de page */}
          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all">
                <i className="fa-solid fa-arrow-left text-xs" /> Retour
              </button>
            ) : (
              <Link href="/espace"
                className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all">
                <i className="fa-solid fa-arrow-left text-xs" /> Annuler
              </Link>
            )}

            {step < TOTAL_STEPS ? (
              <button type="button" onClick={advance}
                className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
                Suivant <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting}
                className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50">
                {isSubmitting
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Publication…</>
                  : <><i className="fa-solid fa-paper-plane" /> Publier l&apos;annonce</>
                }
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}


/* ── Indicateur d'étapes ─────────────────────────────────────────────── */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {STEP_META.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex shrink-0 items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              done   ? 'bg-emerald-500 text-white'      :
              active ? 'bg-gold text-gray-900 shadow-md' :
                       'border border-line bg-bg text-sub'
            }`}>
              {done ? <i className="fa-solid fa-check text-[10px]" /> : i + 1}
            </div>
            <span className={`ml-1.5 mr-1 hidden text-xs font-medium sm:block ${
              active ? 'text-text' : 'text-sub'
            }`}>
              {s.label}
            </span>
            {i < STEP_META.length - 1 && (
              <div className={`mx-1 h-px w-5 transition-all ${done ? 'bg-emerald-400' : 'bg-line'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Récapitulatif ───────────────────────────────────────────────────── */

function RecapCard({ values }: { values: FormValues }) {
  const amenityLabels = (values.amenities || []).map(
    (a) => AMENITIES.find((am) => am.key === a)?.label ?? a
  );
  const meta = TYPE_META[values.type];

  return (
    <div className="space-y-5">
      {/* Aperçu image */}
      {values.images?.[0] && (
        <img src={values.images[0]} alt="Aperçu"
          className="h-52 w-full rounded-xl object-cover border border-line" />
      )}

      {/* Type + Prix */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-sm font-semibold text-text">
          <i className={`fa-solid ${meta.icon} text-gold-dark`} /> {meta.label}
        </span>
        <span className="text-xl font-extrabold text-gold-dark">
          {Number(values.price).toLocaleString('fr-SN')} <span className="text-sm font-semibold text-sub">FCFA/mois</span>
        </span>
      </div>

      {/* Titre */}
      <div>
        <p className="text-base font-bold text-text">{values.title}</p>
        <p className="mt-1 text-sm text-sub line-clamp-2">{values.description}</p>
      </div>

      {/* Grille infos */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {[
          { icon: 'fa-ruler-combined', label: 'Surface',   value: values.surface ? `${values.surface} m²` : '—'       },
          { icon: 'fa-door-open',      label: 'Pièces',    value: values.rooms?.toString() || '—'                     },
          { icon: 'fa-bed',            label: 'Chambres',  value: values.beds?.toString() || '—'                      },
          { icon: 'fa-shower',         label: 'SdB',       value: values.baths?.toString() || '—'                     },
          { icon: 'fa-location-dot',   label: 'Ville',     value: values.city || '—'                                   },
          { icon: 'fa-map',            label: 'Région',    value: values.region || '—'                                 },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-bg px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-sub">{label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-text">
              <i className={`fa-solid ${icon} text-gold-dark text-xs`} /> {value}
            </p>
          </div>
        ))}
      </div>

      {/* Adresse */}
      <div className="flex items-start gap-2 rounded-xl border border-line bg-bg px-3 py-2.5">
        <i className="fa-solid fa-location-dot mt-0.5 text-gold-dark text-xs shrink-0" />
        <p className="text-sm text-text">{values.address}{values.city ? `, ${values.city}` : ''}</p>
      </div>

      {/* Équipements */}
      {amenityLabels.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sub">Équipements</p>
          <div className="flex flex-wrap gap-1.5">
            {amenityLabels.map((a) => (
              <span key={a} className="rounded-full bg-gold-pale px-2.5 py-1 text-xs font-medium text-gold-dark">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Galerie miniatures */}
      {(values.images || []).length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sub">
            {values.images.length} photo(s)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {values.images.map((url, i) => (
              <img key={i} src={url} alt=""
                className="h-14 w-20 shrink-0 rounded-lg border border-line object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-text">{title}</h2>
      <p className="text-sm text-sub">{sub}</p>
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-sub">
      {label}{required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation" /> {error}
        </p>
      )}
    </div>
  );
}
