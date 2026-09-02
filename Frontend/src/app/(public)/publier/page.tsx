'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import LocationPicker from '@/components/map/LocationPicker';

/* ── Constants (no translations needed) ───────────────────────────────── */

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;
const RENTAL_MODES = ['NIGHTLY', 'MONTHLY', 'MIXED'] as const;

const SENEGAL_REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
  'Fatick', 'Kolda', 'Tambacounda', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou', 'Louga', 'Diourbel',
];

// Only icon values at module level — labels come from t() inside component
const TYPE_ICONS: Record<string, string> = {
  APPARTEMENT: 'fa-building',
  VILLA:       'fa-house-chimney',
  STUDIO:      'fa-door-open',
  CHAMBRE:     'fa-bed',
  BUREAU:      'fa-briefcase',
};

const AMENITY_ICONS: Record<string, string> = {
  wifi:       'fa-wifi',
  clim:       'fa-snowflake',
  tv:         'fa-tv',
  cuisine:    'fa-utensils',
  douche:     'fa-shower',
  gardien:    'fa-shield-halved',
  parking:    'fa-car',
  piscine:    'fa-water',
  balcon:     'fa-door-open',
  generateur: 'fa-bolt',
};

const TOTAL_STEPS = 5; // indices 0-4, recap at 5
const DRAFT_KEY = 'aa_listing_draft';

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

/* ── Zod schema factory (translations injected at runtime) ──────────── */

function makeSchema(t: ReturnType<typeof useTranslations<'publish'>>) {
  return z.object({
    type:        z.enum(LISTING_TYPES),
    title:       z.string().min(5,  t('zTitleShort')),
    description: z.string().min(20, t('zDescShort')),
    surface:     z.number().positive().optional(),
    rooms:       z.number().int().min(0).optional(),
    beds:        z.number().int().min(0).optional(),
    baths:       z.number().int().min(0).optional(),
    amenities:   z.array(z.string()).default([]),
    region:      z.string().min(2, t('regionRequired')),
    city:        z.string().min(2, t('zCityRequired')),
    address:     z.string().min(5, t('zAddressRequired')),
    lat:         z.number(),
    lng:         z.number(),
    rentalMode:    z.enum(RENTAL_MODES),
    price:         z.number().positive(t('zPricePositive')).optional(),
    pricePerNight: z.number().positive(t('zPriceNightPositive')).optional(),
    minimumNights: z.number().int().min(1, t('zMinNights')).optional(),
    maximumNights: z.number().int().min(1, t('zMaxNights')).optional(),
    cleaningFee:   z.number().min(0).optional(),
    depositMonths: z.number().int().min(0, t('zDepositRequired')).optional(),
    chargesIncluded: z.boolean().optional(),
    minLeaseMonths:  z.number().int().min(1).optional(),
    images:      z.array(z.string()).min(1, t('zPhotoRequired')),
  }).superRefine((data, ctx) => {
    const needsNightly = data.rentalMode === 'NIGHTLY' || data.rentalMode === 'MIXED';
    const needsMonthly = data.rentalMode === 'MONTHLY' || data.rentalMode === 'MIXED';
    if (needsNightly && !(data.pricePerNight && data.pricePerNight > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pricePerNight'], message: t('zPriceNightPositive') });
    }
    if (needsMonthly && !(data.price && data.price > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: t('zPricePositive') });
    }
    if (needsMonthly && (data.depositMonths === undefined || data.depositMonths === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['depositMonths'], message: t('zDepositRequired') });
    }
    // En mode MIXTE, la durée minimale du bail définit le seuil nuitée/mensuel
    // (voir bookings.service.ts#create) — elle doit donc être renseignée.
    if (data.rentalMode === 'MIXED' && (data.minLeaseMonths === undefined || data.minLeaseMonths === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minLeaseMonths'], message: t('zMinLeaseRequired') });
    }
    // Séjour maximum (optionnel, mode NUITÉE) ne peut pas être < séjour minimum.
    if (
      data.maximumNights !== undefined && data.maximumNights !== null &&
      data.minimumNights !== undefined && data.minimumNights !== null &&
      data.maximumNights < data.minimumNights
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumNights'], message: t('zMaxLessThanMin') });
    }
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/* Champs validés par étape */
const STEP_FIELDS: (keyof FormValues)[][] = [
  ['type', 'title', 'description'],
  ['surface', 'rooms', 'beds', 'baths', 'amenities'],
  ['region', 'city', 'address', 'lat', 'lng'],
  ['rentalMode', 'price', 'pricePerNight', 'minimumNights', 'maximumNights', 'cleaningFee', 'depositMonths', 'chargesIncluded', 'minLeaseMonths'],
  ['images'],
];

/* ── Page principale ─────────────────────────────────────────────────── */

export default function PublierPage() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const t = useTranslations('publish');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-SN';

  const [step,          setStep]          = useState(0);
  const [demoRole,      setDemoRole]      = useState<DemoRole>('visitor');
  const [mounted,       setMounted]       = useState(false);
  const [success,       setSuccess]       = useState<'published' | 'draft' | false>(false);
  const [apiError,      setApiError]      = useState<string | null>(null);
  const [userRoles,     setUserRoles]     = useState<string[]>([]);
  const [rolesLoaded,   setRolesLoaded]   = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitMode,    setSubmitMode]    = useState<'draft' | 'publish'>('publish');

  const prevSignedIn = useRef<boolean | undefined>(undefined);

  // Type/amenity meta computed from translations
  const TYPE_META = useMemo(() => ({
    APPARTEMENT: { icon: 'fa-building',      label: t('typeAppartement') },
    VILLA:       { icon: 'fa-house-chimney', label: t('typeVilla')       },
    STUDIO:      { icon: 'fa-door-open',     label: t('typeStudio')      },
    CHAMBRE:     { icon: 'fa-bed',           label: t('typeChambre')     },
    BUREAU:      { icon: 'fa-briefcase',     label: t('typeBureau')      },
  }), [t]);

  const RENTAL_MODE_META = useMemo(() => ({
    NIGHTLY: { icon: 'fa-moon',        label: t('rentalModeNightly'), desc: t('rentalModeNightlyDesc') },
    MONTHLY: { icon: 'fa-calendar-days', label: t('rentalModeMonthly'), desc: t('rentalModeMonthlyDesc') },
    MIXED:   { icon: 'fa-shuffle',      label: t('rentalModeMixed'),  desc: t('rentalModeMixedDesc')  },
  }), [t]);

  const AMENITIES = useMemo(() => [
    { key: 'wifi',       icon: AMENITY_ICONS.wifi,       label: t('amenityWifi')           },
    { key: 'clim',       icon: AMENITY_ICONS.clim,       label: t('amenityClimatisation')  },
    { key: 'tv',         icon: AMENITY_ICONS.tv,         label: t('amenityTv')             },
    { key: 'cuisine',    icon: AMENITY_ICONS.cuisine,    label: t('amenityCuisine')        },
    { key: 'douche',     icon: AMENITY_ICONS.douche,     label: t('amenityDouche')         },
    { key: 'gardien',    icon: AMENITY_ICONS.gardien,    label: t('amenityGardiennage')    },
    { key: 'parking',    icon: AMENITY_ICONS.parking,    label: t('amenityParking')        },
    { key: 'piscine',    icon: AMENITY_ICONS.piscine,    label: t('amenityPiscine')        },
    { key: 'balcon',     icon: AMENITY_ICONS.balcon,     label: t('amenityBalconTerrasse') },
    { key: 'generateur', icon: AMENITY_ICONS.generateur, label: t('amenityGenerateur')     },
  ], [t]);

  const STEP_LABELS = useMemo(() => [
    { icon: 'fa-tag',          label: t('step0Label') },
    { icon: 'fa-list-check',   label: t('step1Label') },
    { icon: 'fa-location-dot', label: t('step2Label') },
    { icon: 'fa-coins',        label: t('step3Label') },
    { icon: 'fa-images',       label: t('step4Label') },
    { icon: 'fa-eye',          label: t('step5Label') },
  ], [t]);

  const schema = useMemo(() => makeSchema(t), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, watch, setValue, trigger,
    formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      type: 'APPARTEMENT',
      rentalMode: 'MONTHLY',
      amenities: [],
      images: [],
      lat: 14.6937,
      lng: -17.4441,
    },
  });

  // Efface le brouillon quand l'utilisateur se déconnecte
  useEffect(() => {
    if (prevSignedIn.current === true && isSignedIn === false) {
      localStorage.removeItem(DRAFT_KEY);
    }
    if (isSignedIn !== undefined) prevSignedIn.current = isSignedIn;
  }, [isSignedIn]);

  useEffect(() => {
    if (!draftRestored) return;
    const timer = setTimeout(() => setDraftRestored(false), 5000);
    return () => clearTimeout(timer);
  }, [draftRestored]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<FormValues>;
        (Object.entries(draft) as [keyof FormValues, FormValues[keyof FormValues]][]).forEach(
          ([key, val]) => setValue(key, val),
        );
        setDraftRestored(true);
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

  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(async (token) => {
      if (!token) return;
      try {
        const { api: apiLib } = await import('@/lib/api');
        const me = await apiLib.get<{ roles: string[] }>('/auth/me', token);
        if (me.roles.includes('ADMIN')) { router.replace('/espace'); return; }
        if (me.roles.includes('AGENT_TERRAIN')) { router.replace('/agent/verifications'); return; }
        setUserRoles(me.roles);
      } catch {
        setUserRoles([]);
      } finally {
        setRolesLoaded(true);
      }
    });
  }, [isSignedIn, getToken, router]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const values    = watch();
  const isDemo    = !isSignedIn && demoRole !== 'visitor';
  const canAccess = isSignedIn || demoRole !== 'visitor';
  const isBailleur = isDemo || userRoles.some((r) => ['BAILLEUR', 'PRO_AGENCE'].includes(r));

  if (!mounted) return null;

  /* ── Visiteur non connecté ── */
  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
            <i className="fa-solid fa-house-chimney text-2xl text-gold-dark" />
          </div>
          <h1 className="text-xl font-extrabold text-text">{t('signInTitle')}</h1>
          <p className="mt-2 text-sm text-sub">{t('signInDesc')}</p>
          <Link href="/sign-in" className="btn-gold mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
            <i className="fa-solid fa-arrow-right-to-bracket" /> {t('signIn')}
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
    const BECOME_FEATURES = [
      { icon: 'fa-eye',            text: t('becomeFeature1') },
      { icon: 'fa-calendar-check', text: t('becomeFeature2') },
      { icon: 'fa-lock',           text: t('becomeFeature3') },
      { icon: 'fa-comment-dots',   text: t('becomeFeature4') },
      { icon: 'fa-chart-line',     text: t('becomeFeature5') },
    ];
    return (
      <main className="bg-bg min-h-screen py-12 px-4">
        <div className="mx-auto w-full max-w-lg">

          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-pale ring-4 ring-gold/20">
              <i className="fa-solid fa-house-chimney text-2xl text-gold-dark" />
            </div>
            <h1 className="text-2xl font-extrabold text-text">{t('becomeTitle')}</h1>
            <p className="mt-2 text-sm text-sub">{t('becomeSubtitle')}</p>
          </div>

          <div className="mb-5 rounded-2xl border border-line bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sub">{t('becomeFeatureTitle')}</p>
            <ul className="space-y-3">
              {BECOME_FEATURES.map(({ icon, text }) => (
                <li key={icon} className="flex items-start gap-3 text-sm text-text">
                  <i className={`fa-solid ${icon} mt-0.5 shrink-0 text-gold-dark`} />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-5 rounded-2xl border border-gold/30 bg-gold-pale p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold-dark">{t('commissionTitle')}</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-handshake mt-0.5 shrink-0 text-gold-dark" />
                <div>
                  <p className="text-sm font-semibold text-text">{t('commissionSignature')}</p>
                  <p className="mt-0.5 text-xs text-sub">{t('commissionSignatureDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-shield-halved mt-0.5 shrink-0 text-gold-dark" />
                <div>
                  <p className="text-sm font-semibold text-text">{t('verifiedBadgeTitle')}</p>
                  <p className="mt-0.5 text-xs text-sub">{t('verifiedBadgeDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-bolt mt-0.5 shrink-0 text-gold-dark" />
                <div>
                  <p className="text-sm font-semibold text-text">{t('boostTitle')}</p>
                  <p className="mt-0.5 text-xs text-sub">{t('boostDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          <Link href="/become-bailleur"
            className="btn-gold w-full justify-center rounded-full py-3 text-sm font-bold">
            <i className="fa-solid fa-house-chimney-user" /> {t('activateBailleur')}
          </Link>
          <p className="mt-3 text-center text-xs text-sub">{t('commissionNote')}</p>
          <div className="mt-4 text-center">
            <Link href="/espace" className="inline-flex items-center gap-1.5 text-xs text-sub hover:text-gold-dark transition-colors">
              <i className="fa-solid fa-arrow-left text-[10px]" /> {t('backToSpace')}
            </Link>
          </div>

        </div>
      </main>
    );
  }

  /* ── Succès ── */
  if (success) {
    const isDraft = success === 'draft';
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${isDraft ? 'bg-blue-100' : 'bg-emerald-100'}`}>
            <i className={`fa-solid ${isDraft ? 'fa-floppy-disk text-blue-600' : 'fa-circle-check text-emerald-600'} text-2xl`} />
          </div>
          <h1 className="text-xl font-extrabold text-text">
            {isDemo ? t('successDemoTitle') : isDraft ? t('successDraftTitle') : t('successPublishedTitle')}
          </h1>
          <p className="mt-2 text-sm text-sub">
            {isDemo ? t('successDescDemo') : isDraft ? t('successDescDraft') : t('successDescPublished')}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={isDraft ? '/bailleur/listings' : '/espace'}
              className="btn-gold inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              <i className={`fa-solid ${isDraft ? 'fa-list' : 'fa-house-chimney'}`} />
              {isDraft ? t('goToMyListings') : t('goToMySpace')}
            </Link>
            <button
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setSuccess(false); setStep(0); }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all"
            >
              <i className="fa-solid fa-plus" /> {t('publishAnother')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Avancement étape ── */
  const advance = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      setStep((s) => s + 1);
    }
  };

  /* ── Soumission finale ── */
  const onSubmit = async (data: FormValues) => {
    setApiError(null);
    if (isDemo) { setSuccess(submitMode === 'draft' ? 'draft' : 'published'); return; }
    try {
      const token = await getToken();
      await api.post('/listings', {
        ...data,
        status: submitMode === 'publish' ? 'ACTIVE' : 'DRAFT',
      }, token ?? undefined);
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(submitMode === 'draft' ? 'draft' : 'published');
    } catch {
      setApiError(t('apiError'));
    }
  };

  const STEP_HEADERS = [
    { title: t('step0Header'), sub: t('step0Sub') },
    { title: t('step1Header'), sub: t('step1Sub') },
    { title: t('step2Header'), sub: t('step2Sub') },
    { title: t('step3Header'), sub: t('step3Sub') },
    { title: t('step4Header'), sub: t('step4Sub') },
    { title: t('step5Header'), sub: t('step5Sub') },
  ];

  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-2xl">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/bailleur" className="hover:text-gold-dark transition-colors">{t('breadcrumbSpace')}</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('pageTitle')}</span>
        </nav>

        <h1 className="mb-6 flex items-center gap-2 text-xl font-extrabold text-text">
          <i className="fa-solid fa-circle-plus text-gold-dark" /> {t('pageTitle')}
        </h1>

        {/* Bannière brouillon restauré */}
        {draftRestored && (
          <div className="mb-4 flex items-center justify-between gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <span><i className="fa-solid fa-floppy-disk mr-2" />{t('draftRestoredMsg')}</span>
            <button onClick={() => setDraftRestored(false)} className="shrink-0 text-blue-400 hover:text-blue-700 transition-colors">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* Bannière démo */}
        {isDemo && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <i className="fa-solid fa-flask shrink-0" />
            {t('demoModeMsg')}
          </div>
        )}

        {/* Indicateur d'étapes */}
        <StepIndicator current={step} stepLabels={STEP_LABELS} />

        {/* Formulaire */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mt-8 rounded-2xl border border-line bg-card p-6 space-y-6">

            {/* ── Étape 0 : Type & Titre ── */}
            {step === 0 && (
              <>
                <StepHeader title={STEP_HEADERS[0].title} sub={STEP_HEADERS[0].sub} />

                <div>
                  <FieldLabel label={t('fieldTypeLabel')} required />
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {LISTING_TYPES.map((type) => {
                      const active = values.type === type;
                      const meta   = TYPE_META[type];
                      return (
                        <button key={type} type="button" onClick={() => setValue('type', type)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                            active ? 'border-gold bg-gold-pale ring-2 ring-gold/30' : 'border-line bg-bg hover:border-gold/40'
                          }`}>
                          <i className={`fa-solid ${TYPE_ICONS[type]} text-xl ${active ? 'text-gold-dark' : 'text-sub'}`} />
                          <span className={`text-[11px] font-semibold ${active ? 'text-gold-dark' : 'text-sub'}`}>
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label={t('fieldTitleLabel')} error={errors.title?.message} required>
                  <input {...register('title')}
                    placeholder={t('fieldTitlePh')}
                    className="input-field" />
                </Field>

                <Field label={t('fieldDescLabel')} error={errors.description?.message} required>
                  <textarea {...register('description')} rows={5}
                    placeholder={t('fieldDescPh')}
                    className="input-field resize-none" />
                  <p className="mt-1 text-right text-[11px] text-sub">
                    {t('fieldDescCharCount', { count: (values.description || '').length })}
                  </p>
                </Field>
              </>
            )}

            {/* ── Étape 1 : Caractéristiques ── */}
            {step === 1 && (
              <>
                <StepHeader title={STEP_HEADERS[1].title} sub={STEP_HEADERS[1].sub} />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {([
                    { key: 'surface' as const, label: t('fieldSurface'),  ph: '85' },
                    { key: 'rooms'   as const, label: t('fieldRooms'),    ph: '3'  },
                    { key: 'beds'    as const, label: t('fieldBeds'),     ph: '2'  },
                    { key: 'baths'   as const, label: t('fieldBaths'),    ph: '1'  },
                  ]).map(({ key, label, ph }) => (
                    <Field key={key} label={label}>
                      <input type="number" min={0} {...register(key, {
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                      })} placeholder={ph} className="input-field" />
                    </Field>
                  ))}
                </div>

                <div>
                  <FieldLabel label={t('fieldAmenities')} />
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
                <StepHeader title={STEP_HEADERS[2].title} sub={STEP_HEADERS[2].sub} />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('fieldRegion')} error={errors.region?.message} required>
                    <select {...register('region')} className="input-field">
                      <option value="">{t('fieldRegionDefault')}</option>
                      {SENEGAL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label={t('fieldCity')} error={errors.city?.message} required>
                    <input {...register('city')} placeholder={t('fieldCityPh')} className="input-field" />
                  </Field>
                </div>

                <Field label={t('fieldAddress')} error={errors.address?.message} required>
                  <input {...register('address')} placeholder={t('fieldAddressPh')} className="input-field" />
                </Field>

                <div>
                  <p className="mb-2 text-sm font-medium text-text">{t('fieldMapPos')}</p>
                  <div className="h-64 overflow-hidden rounded-2xl border border-line">
                    <LocationPicker
                      defaultLat={values.lat ?? 14.6937}
                      defaultLng={values.lng ?? -17.4441}
                      onChange={(lat, lng) => { setValue('lat', lat); setValue('lng', lng); }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-sub">
                    <i className="fa-solid fa-location-crosshairs mr-1 text-gold-dark" />
                    Lat : {values.lat?.toFixed(4)} — Lng : {values.lng?.toFixed(4)}
                  </p>
                </div>
              </>
            )}

            {/* ── Étape 3 : Mode de location & Prix ── */}
            {step === 3 && (
              <>
                <StepHeader title={STEP_HEADERS[3].title} sub={STEP_HEADERS[3].sub} />

                <div>
                  <FieldLabel label={t('rentalModeLabel')} required />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {RENTAL_MODES.map((mode) => {
                      const active = values.rentalMode === mode;
                      const meta = RENTAL_MODE_META[mode];
                      return (
                        <button key={mode} type="button" onClick={() => setValue('rentalMode', mode)}
                          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                            active ? 'border-gold bg-gold-pale ring-2 ring-gold/30' : 'border-line bg-bg hover:border-gold/40'
                          }`}>
                          <span className="flex items-center gap-2">
                            <i className={`fa-solid ${meta.icon} ${active ? 'text-gold-dark' : 'text-sub'}`} />
                            <span className={`text-sm font-semibold ${active ? 'text-gold-dark' : 'text-text'}`}>{meta.label}</span>
                          </span>
                          <span className="text-[11px] text-sub">{meta.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(values.rentalMode === 'MONTHLY' || values.rentalMode === 'MIXED') && (
                  <div className="rounded-xl border border-line bg-bg/60 p-4 space-y-4">
                    <p className="text-xs font-semibold text-sub uppercase tracking-wide">
                      <i className="fa-solid fa-calendar-days mr-1.5 text-gold-dark" />
                      {t('monthlyTitle')}
                    </p>
                    {values.rentalMode === 'MIXED' && (
                      <p className="text-xs text-sub">
                        {Number(values.minLeaseMonths) > 0
                          ? t('monthlyThresholdNote', { months: Number(values.minLeaseMonths) })
                          : t('monthlyThresholdNoteGeneric')}
                      </p>
                    )}

                    <Field label={t('fieldRent')} error={errors.price?.message} required>
                      <div className="relative">
                        <input type="number" min={0} {...register('price', {
                          setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                        })} placeholder={t('fieldRentPh')} className="input-field pr-16" />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-sub">
                          FCFA
                        </span>
                      </div>
                    </Field>

                    {Number(values.price) > 0 && (
                      <div className="rounded-2xl border border-gold/30 bg-gold-pale px-5 py-4">
                        <p className="text-xs text-sub mb-1">{t('pricePreviewLabel')}</p>
                        <p className="text-3xl font-extrabold text-gold-dark">
                          {Number(values.price).toLocaleString(numLocale)}
                          <span className="ml-2 text-base font-semibold text-sub">{t('fieldRentUnit')}</span>
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t('fieldDepositMonths')} error={errors.depositMonths?.message} required>
                        <input type="number" min={0} {...register('depositMonths', {
                          setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                        })} placeholder={t('fieldDepositMonthsPh')} className="input-field" />
                      </Field>
                      <Field label={t('fieldMinLeaseMonths')} error={errors.minLeaseMonths?.message} required={values.rentalMode === 'MIXED'}>
                        <input type="number" min={1} {...register('minLeaseMonths', {
                          setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                        })} placeholder={t('fieldMinLeaseMonthsPh')} className="input-field" />
                      </Field>
                    </div>

                    {Number(values.price) > 0 && Number(values.depositMonths) > 0 && (() => {
                      const rent = Number(values.price);
                      const brokerFee = Math.round(rent);
                      const landlordDeposit = Math.max(0, Math.round(rent * Number(values.depositMonths)) - brokerFee);
                      return (
                        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs text-blue-800">
                          <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
                          <span>
                            {t('depositCommissionNote', {
                              fee: brokerFee.toLocaleString(numLocale),
                              net: landlordDeposit.toLocaleString(numLocale),
                            })}
                          </span>
                        </div>
                      );
                    })()}

                    <label className="flex items-center gap-2 text-sm text-text">
                      <input type="checkbox" {...register('chargesIncluded')} className="h-4 w-4 rounded border-line accent-gold" />
                      {t('fieldChargesIncluded')}
                    </label>
                  </div>
                )}

                {(values.rentalMode === 'NIGHTLY' || values.rentalMode === 'MIXED') && (
                  <div className="rounded-xl border border-line bg-bg/60 p-4 space-y-3">
                    <p className="text-xs font-semibold text-sub uppercase tracking-wide">
                      <i className="fa-solid fa-moon mr-1.5 text-gold-dark" />
                      {t('shortStayTitle')}
                    </p>
                    <p className="text-xs text-sub">{t('shortStayDesc')}</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t('fieldPriceNight')} error={errors.pricePerNight?.message} required>
                        <div className="relative">
                          <input type="number" min={0} {...register('pricePerNight', {
                            setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                          })} placeholder={t('fieldPriceNightPh')} className="input-field pr-20" />
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-sub">
                            {t('fcfaPerNight')}
                          </span>
                        </div>
                      </Field>
                      <Field label={t('fieldMinNights')} error={errors.minimumNights?.message}>
                        <input type="number" min={1} {...register('minimumNights', {
                          setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                        })} placeholder={t('fieldMinNightsPh')} className="input-field" />
                      </Field>
                    </div>

                    {values.rentalMode === 'NIGHTLY' && (
                      <div>
                        <Field label={t('fieldMaxNights')} error={errors.maximumNights?.message}>
                          <input type="number" min={1} {...register('maximumNights', {
                            setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                          })} placeholder={t('fieldMaxNightsPh')} className="input-field" />
                        </Field>
                        <p className="mt-1.5 text-[11px] text-sub">{t('fieldMaxNightsDesc')}</p>
                      </div>
                    )}

                    <Field label={t('fieldCleaningFee')} error={errors.cleaningFee?.message}>
                      <div className="relative">
                        <input type="number" min={0} {...register('cleaningFee', {
                          setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                        })} placeholder={t('fieldCleaningFeePh')} className="input-field pr-16" />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-sub">
                          FCFA
                        </span>
                      </div>
                    </Field>
                  </div>
                )}
              </>
            )}

            {/* ── Étape 4 : Photos ── */}
            {step === 4 && (
              <>
                <StepHeader title={STEP_HEADERS[4].title} sub={STEP_HEADERS[4].sub} />
                <ImageUploadZone
                  images={values.images || []}
                  onChange={(imgs) => setValue('images', imgs, { shouldValidate: true })}
                  getToken={getToken}
                />
                {errors.images && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500">
                    <i className="fa-solid fa-circle-exclamation" /> {t('photoRequired')}
                  </p>
                )}
              </>
            )}

            {/* ── Étape 5 : Récapitulatif ── */}
            {step === 5 && (
              <>
                <StepHeader title={STEP_HEADERS[5].title} sub={STEP_HEADERS[5].sub} />
                <RecapCard values={values} TYPE_META={TYPE_META} AMENITIES={AMENITIES} numLocale={numLocale} />
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
                <i className="fa-solid fa-arrow-left text-xs" /> {t('backBtn')}
              </button>
            ) : (
              <Link href="/espace"
                className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all">
                <i className="fa-solid fa-arrow-left text-xs" /> {t('cancelBtn')}
              </Link>
            )}

            {step < TOTAL_STEPS ? (
              <button type="button" onClick={advance}
                className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold">
                {t('nextBtn')} <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={() => setSubmitMode('draft')}
                  className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all disabled:opacity-50"
                >
                  {isSubmitting && submitMode === 'draft'
                    ? <><i className="fa-solid fa-spinner fa-spin" /> {t('savingDraft')}</>
                    : <><i className="fa-solid fa-floppy-disk text-xs" /> {t('draftBtn')}</>
                  }
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={() => setSubmitMode('publish')}
                  className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {isSubmitting && submitMode === 'publish'
                    ? <><i className="fa-solid fa-spinner fa-spin" /> {t('publishing')}</>
                    : <><i className="fa-solid fa-paper-plane text-xs" /> {t('publishBtn')}</>
                  }
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

/* ── Indicateur d'étapes ─────────────────────────────────────────────── */

function StepIndicator({
  current,
  stepLabels,
}: {
  current: number;
  stepLabels: { icon: string; label: string }[];
}) {
  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {stepLabels.map((s, i) => {
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
            <span className={`ml-1.5 mr-1 hidden text-xs font-medium sm:block ${active ? 'text-text' : 'text-sub'}`}>
              {s.label}
            </span>
            {i < stepLabels.length - 1 && (
              <div className={`mx-1 h-px w-5 transition-all ${done ? 'bg-emerald-400' : 'bg-line'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Récapitulatif ───────────────────────────────────────────────────── */

function RecapCard({
  values,
  TYPE_META,
  AMENITIES,
  numLocale,
}: {
  values: FormValues;
  TYPE_META: Record<string, { icon: string; label: string }>;
  AMENITIES: { key: string; icon: string; label: string }[];
  numLocale: string;
}) {
  const t = useTranslations('publish');
  const amenityLabels = (values.amenities || []).map(
    (a) => AMENITIES.find((am) => am.key === a)?.label ?? a
  );
  const meta = TYPE_META[values.type];

  const recapItems = [
    { icon: 'fa-ruler-combined', label: t('recapSurface'), value: values.surface ? `${values.surface} m²` : '—' },
    { icon: 'fa-door-open',      label: t('recapPieces'),  value: values.rooms?.toString() || '—'              },
    { icon: 'fa-bed',            label: t('recapBeds'),    value: values.beds?.toString() || '—'               },
    { icon: 'fa-shower',         label: t('recapSdb'),     value: values.baths?.toString() || '—'              },
    { icon: 'fa-location-dot',   label: t('recapCity'),    value: values.city || '—'                           },
    { icon: 'fa-map',            label: t('recapRegion'),  value: values.region || '—'                         },
  ];

  return (
    <div className="space-y-5">
      {values.images?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={values.images[0]} alt=""
          className="h-52 w-full rounded-xl object-cover border border-line" />
      )}

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-sm font-semibold text-text">
          <i className={`fa-solid ${meta.icon} text-gold-dark`} /> {meta.label}
        </span>
        <span className="text-right">
          {(values.rentalMode === 'MONTHLY' || values.rentalMode === 'MIXED') && Number(values.price) > 0 && (
            <span className="block text-xl font-extrabold text-gold-dark">
              {Number(values.price).toLocaleString(numLocale)}
              <span className="ml-1 text-sm font-semibold text-sub"> {t('fieldRentUnit')}</span>
            </span>
          )}
          {(values.rentalMode === 'NIGHTLY' || values.rentalMode === 'MIXED') && Number(values.pricePerNight) > 0 && (
            <span className="block text-xs font-semibold text-sub">
              {t('recapPriceNight')} : {Number(values.pricePerNight).toLocaleString(numLocale)} {t('fcfaPerNight')}
            </span>
          )}
          {(values.rentalMode === 'MONTHLY' || values.rentalMode === 'MIXED') && values.depositMonths !== undefined && (
            <span className="block text-xs font-semibold text-sub">
              {t('recapDeposit')} : {values.depositMonths} {t('recapDepositUnit')}
            </span>
          )}
        </span>
      </div>

      <div>
        <p className="text-base font-bold text-text">{values.title}</p>
        <p className="mt-1 text-sm text-sub line-clamp-2">{values.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {recapItems.map(({ icon, label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-bg px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-sub">{label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-text">
              <i className={`fa-solid ${icon} text-gold-dark text-xs`} /> {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-line bg-bg px-3 py-2.5">
        <i className="fa-solid fa-location-dot mt-0.5 text-gold-dark text-xs shrink-0" />
        <p className="text-sm text-text">{values.address}{values.city ? `, ${values.city}` : ''}</p>
      </div>

      {amenityLabels.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sub">{t('recapEquipements')}</p>
          <div className="flex flex-wrap gap-1.5">
            {amenityLabels.map((a) => (
              <span key={a} className="rounded-full bg-gold-pale px-2.5 py-1 text-xs font-medium text-gold-dark">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {(values.images || []).length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sub">
            {t('photosCount', { count: values.images.length })}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {values.images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
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
