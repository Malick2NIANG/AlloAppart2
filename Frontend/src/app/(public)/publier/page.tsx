'use client';

import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { apiErrorDetail } from '@/lib/apiError';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import LocationPicker, { type MapFocus } from '@/components/map/LocationPicker';
import MobileStepperBar from '@/components/ui/MobileStepperBar';
import StickyStepActions from '@/components/ui/StickyStepActions';
import BottomSheet from '@/components/ui/BottomSheet';
import { getListingProfile, sanitizeForType, TERRAIN_AMENITY_ICONS } from '@/lib/listingProfile';
import { REGION_CENTERS, checkRegionConsistency, findRegionAt, getRegionFeature } from '@/lib/senegalRegions';

/* ── Constants (no translations needed) ───────────────────────────────── */

// Types valides en mode LOCATION (historique) vs VENTE directe (agences
// abonnées actives uniquement) — APPARTEMENT/VILLA restent valides dans les
// deux modes, le reste est réservé à un seul mode (cf. listings.service.ts
// backend, assertValidTransactionTypeUsage, règle identique).
const LOCATION_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;
const VENTE_TYPES = ['APPARTEMENT', 'VILLA', 'TERRAIN', 'MAISON', 'LOCAL_COMMERCIAL'] as const;
const ALL_LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU', 'TERRAIN', 'MAISON', 'LOCAL_COMMERCIAL'] as const;
const RENTAL_MODES = ['NIGHTLY', 'MONTHLY', 'MIXED'] as const;
const TRANSACTION_TYPES = ['LOCATION', 'VENTE'] as const;

const SENEGAL_REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
  'Fatick', 'Kolda', 'Tambacounda', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou', 'Louga', 'Diourbel',
];

// Only icon values at module level — labels come from t() inside component
const TYPE_ICONS: Record<string, string> = {
  APPARTEMENT:      'fa-building',
  VILLA:            'fa-house-chimney',
  STUDIO:           'fa-door-open',
  CHAMBRE:          'fa-bed',
  BUREAU:           'fa-briefcase',
  TERRAIN:          'fa-map-location-dot',
  MAISON:           'fa-house',
  LOCAL_COMMERCIAL: 'fa-store',
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
  ...TERRAIN_AMENITY_ICONS,
};

const TOTAL_STEPS = 5; // indices 0-4, recap at 5
const DRAFT_KEY = 'aa_listing_draft';

type DemoRole = 'visitor' | 'locataire' | 'bailleur' | 'dual' | 'admin' | 'agent';

/* ── Zod schema factory (translations injected at runtime) ──────────── */

function makeSchema(t: ReturnType<typeof useTranslations<'publish'>>) {
  return z.object({
    type:        z.enum(ALL_LISTING_TYPES),
    transactionType: z.enum(TRANSACTION_TYPES),
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
    // Sans objet en mode VENTE (prix de vente unique, pas de mode locatif).
    rentalMode:    z.enum(RENTAL_MODES).optional(),
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
    // Région choisie et point sur la carte doivent concorder (contours embarqués,
    // marge près des frontières — cf. lib/senegalRegions.ts). Erreur affichée sur le champ région.
    const regionCheck = checkRegionConsistency(data.region, data.lat, data.lng);
    if (!regionCheck.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['region'],
        message: regionCheck.reason === 'mismatch'
          ? t('zRegionMismatch', { detected: regionCheck.detected, region: data.region })
          : t('zRegionOutside', { region: data.region }),
      });
    }
    // Un terrain se décrit avant tout par sa superficie : obligatoire.
    if (getListingProfile(data.type).surfaceRequired && !(data.surface && data.surface > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['surface'], message: t('zSurfaceRequired') });
    }
    // ── Mode VENTE : un seul champ requis, le prix de vente (réutilise `price`) ──
    if (data.transactionType === 'VENTE') {
      if (!(data.price && data.price > 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: t('zSalePricePositive') });
      }
      return;
    }
    // ── Mode LOCATION : validations historiques selon rentalMode ──
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
  ['type', 'transactionType', 'title', 'description'],
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
  // Plafond de 10 annonces actives atteint (compte particulier, sans
  // abonnement) — bloque une simple erreur générique au profit d'une invite
  // claire à devenir agence professionnelle (limit vient du corps structuré
  // renvoyé par le backend, ex: { code: 'ACTIVE_LISTING_LIMIT', limit: 10 }).
  // Ce code ne concerne jamais les agences : avec un abonnement actif
  // (STARTER ou PRO), elles n'ont aucune limite de nombre d'annonces.
  const [upgradeModal,  setUpgradeModal]  = useState<{ limit: number } | null>(null);
  const [userRoles,     setUserRoles]     = useState<string[]>([]);
  const [rolesLoaded,   setRolesLoaded]   = useState(false);
  // Vente directe réservée aux agences PRO_AGENCE avec abonnement actif (peu
  // importe le plan — même règle que la publication, cf. assertCanPublish()
  // backend). /subscriptions/me renvoie 403 pour un non-PRO_AGENCE, traité
  // comme "pas éligible" (même schéma défensif qu'ailleurs dans l'app).
  const [canUseVenteMode, setCanUseVenteMode] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // Recentrage de la carte quand l'utilisateur choisit une région (étape Localisation).
  const [mapFocus, setMapFocus] = useState<MapFocus | undefined>(undefined);
  const [submitMode,    setSubmitMode]    = useState<'draft' | 'publish'>('publish');
  // Remplace handleSubmit(onSubmit) pour les 2 boutons Brouillon/Publier —
  // bug trouvé en testant /publier avec une vraie session (lot 3a/3b) :
  // avec `type="submit"` + `onClick={() => setSubmitMode('draft')}`, la mise
  // à jour d'état n'est pas encore appliquée quand le `submit` natif déclenche
  // handleSubmit(onSubmit) dans le même tick — onSubmit lisait donc l'ancienne
  // valeur de submitMode (toujours 'publish' par défaut au premier clic) : le
  // bouton "Enregistrer comme brouillon" publiait réellement l'annonce. En
  // passant le mode explicitement en paramètre (au lieu de le lire depuis un
  // state asynchrone), le bouton cliqué fait toujours ce qu'il annonce. Même
  // bug présent sur les deux variantes (desktop déjà existante, mobile
  // copiée à l'identique lot 3a) — corrigé ici pour les deux à la fois,
  // sans aucun changement visuel (ni classes, ni rendu).
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const prevSignedIn = useRef<boolean | undefined>(undefined);

  // Type/amenity meta computed from translations
  const TYPE_META = useMemo(() => ({
    APPARTEMENT:      { icon: 'fa-building',           label: t('typeAppartement')     },
    VILLA:            { icon: 'fa-house-chimney',      label: t('typeVilla')           },
    STUDIO:           { icon: 'fa-door-open',          label: t('typeStudio')          },
    CHAMBRE:          { icon: 'fa-bed',                label: t('typeChambre')         },
    BUREAU:           { icon: 'fa-briefcase',          label: t('typeBureau')          },
    TERRAIN:          { icon: 'fa-map-location-dot',   label: t('typeTerrain')         },
    MAISON:           { icon: 'fa-house',              label: t('typeMaison')          },
    LOCAL_COMMERCIAL: { icon: 'fa-store',               label: t('typeLocalCommercial') },
  }), [t]);

  const TRANSACTION_TYPE_META = useMemo(() => ({
    LOCATION: { icon: 'fa-key',    label: t('transactionTypeLocation'), desc: t('transactionTypeLocationDesc') },
    VENTE:    { icon: 'fa-sack-dollar', label: t('transactionTypeVente'),    desc: t('transactionTypeVenteDesc')    },
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
    // Équipements propres aux terrains (cf. lib/listingProfile.ts)
    { key: 'viabilise',     icon: AMENITY_ICONS.viabilise,     label: t('amenityViabilise')    },
    { key: 'eau',           icon: AMENITY_ICONS.eau,           label: t('amenityEau')          },
    { key: 'electricite',   icon: AMENITY_ICONS.electricite,   label: t('amenityElectricite')  },
    { key: 'titre_foncier', icon: AMENITY_ICONS.titre_foncier, label: t('amenityTitreFoncier') },
    { key: 'cloture',       icon: AMENITY_ICONS.cloture,       label: t('amenityCloture')      },
    { key: 'acces_route',   icon: AMENITY_ICONS.acces_route,   label: t('amenityAccesRoute')   },
  ], [t]);

  const STEP_LABELS = useMemo(() => [
    { icon: 'fa-tag',          label: t('step0Label') },
    { icon: 'fa-list-check',   label: t('step1Label') },
    { icon: 'fa-location-dot', label: t('step2Label') },
    { icon: 'fa-coins',        label: t('step3Label') },
    { icon: 'fa-images',       label: t('step4Label') },
    { icon: 'fa-eye',          label: t('step5Label') },
  ], [t]);

  const UPGRADE_BENEFITS = useMemo(() => [
    { icon: 'fa-infinity',      text: t('upgradeBenefitUnlimited') },
    { icon: 'fa-chart-line',    text: t('upgradeBenefitAnalytics') },
    { icon: 'fa-shield-halved', text: t('upgradeBenefitBadge')     },
    { icon: 'fa-headset',       text: t('upgradeBenefitSupport')   },
  ], [t]);

  const upgradeModalTitleId = useId();

  const schema = useMemo(() => makeSchema(t), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { register, watch, setValue, trigger,
    formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      type: 'APPARTEMENT',
      transactionType: 'LOCATION',
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

  // Sous 768px, l'en-tête compact (MobileStepperBar) est collé en haut mais
  // le défilement de la page n'est pas réinitialisé par React au changement
  // d'étape : sans ce correctif, avancer depuis le bas de l'étape précédente
  // (bouton de StickyStepActions) laisse la nouvelle étape scrollée hors
  // champ. Sans effet ≥768px, où ce bug n'a jamais existé (StepIndicator en
  // haut de page, jamais manipulé en scrollant vers le bas).
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      window.scrollTo(0, 0);
    }
  }, [step]);

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
        if (me.roles.includes('PRO_AGENCE')) {
          try {
            const sub = await apiLib.get<{ status: string } | null>('/subscriptions/me', token);
            setCanUseVenteMode(sub?.status === 'ACTIVE');
          } catch {
            setCanUseVenteMode(false);
          }
        }
      } catch {
        setUserRoles([]);
      } finally {
        setRolesLoaded(true);
      }
    });
  }, [isSignedIn, getToken, router]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const values    = watch();
  // Champs/équipements des étapes suivantes selon le type choisi à l'étape 1.
  const profile   = getListingProfile(values.type);
  const isDemo    = !isSignedIn && demoRole !== 'visitor';
  const canAccess = isSignedIn || demoRole !== 'visitor';
  const isBailleur = isDemo || userRoles.some((r) => ['BAILLEUR', 'PRO_AGENCE'].includes(r));
  // En démo, on affiche le choix VENTE pour l'aperçu UI même sans abonnement réel.
  const canShowVenteToggle = isDemo || canUseVenteMode;

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

          <div className="mb-8">
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
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${isDraft ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-emerald-100 dark:bg-emerald-950/40'}`}>
            <i className={`fa-solid ${isDraft ? 'fa-floppy-disk text-blue-600 dark:text-blue-400' : 'fa-circle-check text-emerald-600 dark:text-emerald-400'} text-2xl`} />
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

  /* ── Soumission finale ── le mode est reçu en paramètre (pas relu depuis
     submitMode) pour que le bouton cliqué fasse toujours ce qu'il annonce,
     même au tout premier clic — voir le commentaire sur manualSubmitting. */
  const submitListing = async (mode: 'draft' | 'publish') => {
    if (manualSubmitting) return;
    setManualSubmitting(true);
    setSubmitMode(mode);
    setApiError(null);
    setUpgradeModal(null);
    if (isDemo) { setSuccess(mode === 'draft' ? 'draft' : 'published'); setManualSubmitting(false); return; }
    try {
      const token = await getToken();
      await api.post('/listings', {
        // Retire pièces/chambres/sdb/équipements sans objet pour ce type de bien.
        ...sanitizeForType(values),
        status: mode === 'publish' ? 'ACTIVE' : 'DRAFT',
      }, token ?? undefined);
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(mode === 'draft' ? 'draft' : 'published');
    } catch (err: unknown) {
      // Le plafond d'annonces actives (compte particulier) renvoie un code
      // structuré (pas juste un message texte) pour qu'on puisse afficher une
      // vraie invite à devenir agence plutôt qu'un message d'erreur générique.
      const errBody = (err as { data?: { code?: string; limit?: number } } | undefined)?.data;
      if (errBody?.code === 'ACTIVE_LISTING_LIMIT') {
        setUpgradeModal({ limit: errBody.limit ?? 10 });
      } else {
        // Erreur de validation (400) : on affiche le détail renvoyé par l'API
        // pour que l'utilisateur sache quoi corriger ; sinon message générique.
        const detail = apiErrorDetail(err);
        setApiError(detail ? `${t('apiError')} ${detail}` : t('apiError'));
      }
    } finally {
      setManualSubmitting(false);
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

  const isFirstStep = step === 0;
  const totalSteps = TOTAL_STEPS + 1; // + récapitulatif
  const mobileStepTitle = STEP_HEADERS[step].title;

  return (
    <main className="py-10 px-4 bg-bg min-h-screen max-md:min-h-dvh max-md:flex max-md:flex-col max-md:px-0 max-md:py-0">
      {/* Voir le même correctif sur /profil/page.tsx pour l'explication
          complète : margin-inline:auto + flex item d'un parent flex-col
          déclenche l'alignement "auto margin" de flexbox au lieu du
          stretch, provoquant un débordement horizontal. Corrigé dans
          globals.css (margin-inline:0 sous 768px pour .aa-container). */}
      <div className="aa-container max-w-2xl max-md:flex max-md:flex-1 max-md:flex-col">

        {/* Breadcrumb + titre — remplacés sous 768px par MobileStepperBar */}
        <div className="max-md:hidden">
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-sub">
            <Link href="/bailleur" className="hover:text-gold-dark transition-colors">{t('breadcrumbSpace')}</Link>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
            <span className="text-gold-dark font-medium">{t('pageTitle')}</span>
          </nav>

          <h1 className="mb-6 flex items-center gap-2 text-xl font-extrabold text-text">
            <i className="fa-solid fa-circle-plus text-gold-dark" /> {t('pageTitle')}
          </h1>
        </div>

        <MobileStepperBar
          current={step}
          total={totalSteps}
          title={mobileStepTitle}
          stepLabel={t('stepLabel', { current: step + 1, total: totalSteps })}
          isFirstStep={isFirstStep}
          onBack={() => setStep((s) => s - 1)}
          onQuit={() => router.push('/espace')}
          quitLabel={t('cancelBtn')}
          backLabel={t('backBtn')}
        />

        {/* Bannière brouillon restauré */}
        {draftRestored && (
          <div className="mb-4 flex items-center justify-between gap-2.5 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
            <span><i className="fa-solid fa-floppy-disk mr-2" />{t('draftRestoredMsg')}</span>
            <button onClick={() => setDraftRestored(false)} className="shrink-0 text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* Bannière démo */}
        {isDemo && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <i className="fa-solid fa-flask shrink-0" />
            {t('demoModeMsg')}
          </div>
        )}

        {/* Indicateur d'étapes — remplacé sous 768px par MobileStepperBar ci-dessus */}
        <div className="max-md:hidden">
          <StepIndicator current={step} stepLabels={STEP_LABELS} />
        </div>

        {/* Formulaire */}
        {/* Les boutons Brouillon/Publier appellent submitListing() directement
            (plus de soumission native du formulaire) — onSubmit n'empêche
            plus que la navigation par défaut si Entrée est pressé dans un champ. */}
        <form onSubmit={(e) => e.preventDefault()} className="max-md:flex max-md:flex-1 max-md:flex-col">
          <div className="mt-8 rounded-2xl border border-line bg-card p-6 space-y-6 max-md:mt-3 max-md:flex-1 max-md:space-y-5 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0">

            {/* ── Étape 0 : Type & Titre ── */}
            {step === 0 && (
              <>
                <StepHeader title={STEP_HEADERS[0].title} sub={STEP_HEADERS[0].sub} />

                {canShowVenteToggle && (
                  <div>
                    <FieldLabel label={t('transactionTypeLabel')} required />
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {TRANSACTION_TYPES.map((tx) => {
                        const active = values.transactionType === tx;
                        const meta = TRANSACTION_TYPE_META[tx];
                        return (
                          <button key={tx} type="button" onClick={() => {
                              setValue('transactionType', tx);
                              // Le type de bien choisi doit rester cohérent avec le
                              // nouveau mode (cf. LOCATION_TYPES/VENTE_TYPES) — sinon
                              // on repart sur APPARTEMENT, valide dans les deux modes.
                              const validTypes: readonly string[] = tx === 'VENTE' ? VENTE_TYPES : LOCATION_TYPES;
                              if (!validTypes.includes(values.type)) setValue('type', 'APPARTEMENT');
                            }}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all max-md:min-h-11 ${
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
                )}

                <div>
                  <FieldLabel label={t('fieldTypeLabel')} required />
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {(values.transactionType === 'VENTE' ? VENTE_TYPES : LOCATION_TYPES).map((type) => {
                      const active = values.type === type;
                      const meta   = TYPE_META[type];
                      return (
                        <button key={type} type="button" onClick={() => setValue('type', type)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all max-md:min-h-11 ${
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
                    { key: 'surface' as const, label: values.type === 'TERRAIN' ? t('fieldSurfaceLand') : t('fieldSurface'), ph: values.type === 'TERRAIN' ? '300' : '85', show: true,          required: profile.surfaceRequired },
                    { key: 'rooms'   as const, label: t('fieldRooms'), ph: '3', show: profile.rooms, required: false },
                    { key: 'beds'    as const, label: t('fieldBeds'),  ph: '2', show: profile.beds,  required: false },
                    { key: 'baths'   as const, label: t('fieldBaths'), ph: '1', show: profile.baths, required: false },
                  ]).filter((f) => f.show).map(({ key, label, ph, required }) => (
                    <Field key={key} label={label} required={required} error={key === 'surface' ? errors.surface?.message : undefined}>
                      <input type="number" min={0} {...register(key, {
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                      })} placeholder={ph} className="input-field" />
                    </Field>
                  ))}
                </div>

                <div>
                  <FieldLabel label={values.type === 'TERRAIN' ? t('fieldLandFeatures') : t('fieldAmenities')} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {profile.amenities
                      .map((k) => AMENITIES.find((am) => am.key === k))
                      .filter((am): am is NonNullable<typeof am> => !!am)
                      .map(({ key, icon, label }) => {
                      const active = (values.amenities || []).includes(key);
                      return (
                        <button key={key} type="button"
                          onClick={() => {
                            const cur = values.amenities || [];
                            setValue('amenities', active ? cur.filter((a) => a !== key) : [...cur, key]);
                          }}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all max-md:min-h-11 ${
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
                    <select
                      {...register('region', {
                        // Choisir une région recentre la carte et y place le repère ;
                        // l'utilisateur affine ensuite en cliquant sur la carte.
                        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                          const c = REGION_CENTERS[e.target.value];
                          if (!c) return;
                          setValue('lat', c.lat);
                          setValue('lng', c.lng);
                          setMapFocus({ lat: c.lat, lng: c.lng, zoom: c.zoom, nonce: Date.now() });
                        },
                      })}
                      className="input-field"
                    >
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
                  <div className="h-64 max-md:h-72 overflow-hidden rounded-2xl border border-line">
                    <LocationPicker
                      defaultLat={values.lat ?? 14.6937}
                      defaultLng={values.lng ?? -17.4441}
                      focus={mapFocus}
                      highlight={getRegionFeature(values.region)}
                      onChange={(lat, lng) => {
                        setValue('lat', lat);
                        setValue('lng', lng);
                        // La carte fait foi : la région se met à jour toute seule (sans effet
                        // hors Sénégal ou sans contours — l'erreur du champ le signalera).
                        const detected = findRegionAt(lat, lng);
                        if (detected) setValue('region', detected);
                        void trigger('region');
                      }}
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
            {step === 3 && values.transactionType === 'VENTE' && (
              <>
                <StepHeader title={t('step3HeaderVente')} sub={t('step3SubVente')} />

                <Field label={t('fieldSalePrice')} error={errors.price?.message} required>
                  <div className="relative">
                    <input type="number" min={0} {...register('price', {
                      setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                    })} placeholder={t('fieldSalePricePh')} className="input-field pr-16" />
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
                      <span className="ml-2 text-base font-semibold text-sub">FCFA</span>
                    </p>
                  </div>
                )}
              </>
            )}

            {step === 3 && values.transactionType !== 'VENTE' && (
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
                          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all max-md:min-h-11 ${
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
                        <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 px-3.5 py-3 text-xs text-blue-800">
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
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    <i className="fa-solid fa-circle-exclamation shrink-0" /> {apiError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation bas de page — inchangée ≥768px */}
          <div className="mt-6 flex items-center justify-between max-md:hidden">
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
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => void submitListing('draft')}
                  className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-sub hover:border-gold/50 hover:text-gold-dark transition-all disabled:opacity-50"
                >
                  {manualSubmitting && submitMode === 'draft'
                    ? <><i className="fa-solid fa-spinner fa-spin" /> {t('savingDraft')}</>
                    : <><i className="fa-solid fa-floppy-disk text-xs" /> {t('draftBtn')}</>
                  }
                </button>
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => void submitListing('publish')}
                  className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {manualSubmitting && submitMode === 'publish'
                    ? <><i className="fa-solid fa-spinner fa-spin" /> {t('publishing')}</>
                    : <><i className="fa-solid fa-paper-plane text-xs" /> {t('publishBtn')}</>
                  }
                </button>
              </div>
            )}
          </div>

          {/* Barre d'actions mobile — sous 768px uniquement. Le "Précédent" vit
              dans MobileStepperBar (bouton retour de l'en-tête) ; cette barre
              ne porte que l'action principale de l'étape. */}
          <StickyStepActions
            error={
              step === 4 && errors.images ? t('photoRequired')
              : step === 5 && apiError ? apiError
              : undefined
            }
          >
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={advance}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-light text-sm font-semibold text-gray-900 shadow-md transition active:scale-[0.98]">
                {t('nextBtn')} <i className="fa-solid fa-arrow-right text-xs" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => void submitListing('draft')}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-semibold text-sub transition active:scale-[0.98] disabled:opacity-50"
                >
                  {manualSubmitting && submitMode === 'draft'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-floppy-disk text-xs" /> {t('draftBtn')}</>
                  }
                </button>
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => void submitListing('publish')}
                  className="flex h-12 flex-[1.3] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gold to-gold-light text-sm font-semibold text-gray-900 shadow-md transition active:scale-[0.98] disabled:opacity-50"
                >
                  {manualSubmitting && submitMode === 'publish'
                    ? <i className="fa-solid fa-spinner fa-spin" />
                    : <><i className="fa-solid fa-paper-plane text-xs" /> {t('publishBtn')}</>
                  }
                </button>
              </>
            )}
          </StickyStepActions>
        </form>
      </div>

      {/* Plafond de 10 annonces actives atteint (compte particulier) — invite à devenir agence plutôt qu'une erreur brute.
          ≥768px : rendu historique inchangé (classes identiques à avant ce lot).
          <768px : BottomSheet (lot 3a), même contenu, mêmes gestionnaires. */}
      {upgradeModal && (
        <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-gold to-gold-light px-6 py-5 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mb-3">
                <i className="fa-solid fa-crown text-white text-2xl" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-900">{t('upgradeModalTitle')}</h2>
              <p className="text-sm text-gray-800/80 mt-1">
                {t('upgradeModalLimitReached', { limit: upgradeModal.limit })}
              </p>
            </div>

            <div className="p-6">
              <p className="text-sm text-sub mb-4">{t('upgradeModalDesc')}</p>
              <div className="space-y-2.5 mb-6">
                {UPGRADE_BENEFITS.map((item) => (
                  <div key={item.icon} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg border border-line text-gold-dark">
                      <i className={`fa-solid ${item.icon} text-xs`} />
                    </span>
                    <p className="text-sm text-text">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setUpgradeModal(null)}
                  className="flex-1 rounded-xl border border-line py-3 text-sm font-medium text-sub hover:text-text hover:border-text/30 transition-colors"
                >
                  {t('upgradeModalLater')}
                </button>
                <Link
                  href="/bailleur/abonnement"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold-dark hover:bg-gold-dark/90 text-white font-semibold py-3 text-sm transition-colors"
                >
                  <i className="fa-solid fa-crown text-xs" />
                  {t('upgradeModalCta')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="md:hidden">
        <BottomSheet open={!!upgradeModal} onClose={() => setUpgradeModal(null)} titleId={upgradeModalTitleId}>
          {upgradeModal && (
            <>
              <div className="-mx-6 rounded-t-xl bg-gradient-to-r from-gold to-gold-light px-6 py-5 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mb-3">
                  <i className="fa-solid fa-crown text-white text-2xl" />
                </div>
                <h2 id={upgradeModalTitleId} className="text-xl font-extrabold text-gray-900">{t('upgradeModalTitle')}</h2>
                <p className="text-sm text-gray-800/80 mt-1">
                  {t('upgradeModalLimitReached', { limit: upgradeModal.limit })}
                </p>
              </div>

              <div className="pt-5">
                <p className="text-sm text-sub mb-4">{t('upgradeModalDesc')}</p>
                <div className="space-y-2.5 mb-6">
                  {UPGRADE_BENEFITS.map((item) => (
                    <div key={item.icon} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg border border-line text-gold-dark">
                        <i className={`fa-solid ${item.icon} text-xs`} />
                      </span>
                      <p className="text-sm text-text">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setUpgradeModal(null)}
                    className="tap-target flex-1 rounded-xl border border-line py-3 text-sm font-medium text-sub"
                  >
                    {t('upgradeModalLater')}
                  </button>
                  <Link
                    href="/bailleur/abonnement"
                    className="tap-target flex-1 flex items-center justify-center gap-2 rounded-xl bg-gold-dark text-white font-semibold py-3 text-sm"
                  >
                    <i className="fa-solid fa-crown text-xs" />
                    {t('upgradeModalCta')}
                  </Link>
                </div>
              </div>
            </>
          )}
        </BottomSheet>
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
  // Seuls les champs/équipements pertinents pour ce type de bien sont récapitulés.
  const profile = getListingProfile(values.type);
  const amenityLabels = (values.amenities || [])
    .filter((a) => profile.amenities.includes(a))
    .map((a) => AMENITIES.find((am) => am.key === a)?.label ?? a);
  const meta = TYPE_META[values.type];

  const recapItems = [
    { icon: 'fa-ruler-combined', label: t('recapSurface'), value: values.surface ? `${values.surface} m²` : '—', show: true },
    { icon: 'fa-door-open',      label: t('recapPieces'),  value: values.rooms?.toString() || '—',              show: profile.rooms },
    { icon: 'fa-bed',            label: t('recapBeds'),    value: values.beds?.toString() || '—',               show: profile.beds },
    { icon: 'fa-shower',         label: t('recapSdb'),     value: values.baths?.toString() || '—',              show: profile.baths },
    { icon: 'fa-location-dot',   label: t('recapCity'),    value: values.city || '—',                           show: true },
    { icon: 'fa-map',            label: t('recapRegion'),  value: values.region || '—',                         show: true },
  ].filter((item) => item.show);

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
          {values.transactionType === 'VENTE' ? (
            Number(values.price) > 0 && (
              <span className="block text-xl font-extrabold text-gold-dark">
                {Number(values.price).toLocaleString(numLocale)}
                <span className="ml-1 text-sm font-semibold text-sub"> FCFA</span>
              </span>
            )
          ) : (
            <>
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
            </>
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
