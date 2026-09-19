'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Listing } from '@/types';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import LocationPicker from '@/components/map/LocationPicker';

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;
const RENTAL_MODES = ['NIGHTLY', 'MONTHLY', 'MIXED'] as const;

const SENEGAL_REGIONS = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
  'Fatick', 'Kolda', 'Tambacounda', 'Matam', 'Kaffrine',
  'Sédhiou', 'Kédougou', 'Louga', 'Diourbel',
];

// Icônes de type — mêmes valeurs que publier/page.tsx (icon-chips au lieu d'un <select>).
const TYPE_ICONS: Record<string, string> = {
  APPARTEMENT: 'fa-building',
  VILLA:       'fa-house-chimney',
  STUDIO:      'fa-door-open',
  CHAMBRE:     'fa-bed',
  BUREAU:      'fa-briefcase',
};

const AMENITY_KEYS = [
  { key: 'wifi',       icon: 'fa-wifi',         tKey: 'amenityWifi'      },
  { key: 'clim',       icon: 'fa-snowflake',     tKey: 'amenityAirCon'   },
  { key: 'tv',         icon: 'fa-tv',            tKey: 'amenityTv'       },
  { key: 'cuisine',    icon: 'fa-utensils',      tKey: 'amenityKitchen'  },
  { key: 'douche',     icon: 'fa-shower',        tKey: 'amenityShower'   },
  { key: 'gardien',    icon: 'fa-shield-halved', tKey: 'amenitySecurity' },
  { key: 'parking',    icon: 'fa-car',           tKey: 'amenityParking'  },
  { key: 'piscine',    icon: 'fa-water',         tKey: 'amenityPool'     },
  { key: 'balcon',     icon: 'fa-door-open',     tKey: 'amenityBalcony'  },
  { key: 'generateur', icon: 'fa-bolt',          tKey: 'amenityGenerator'},
] as const;

const asNumberOrUndefined = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const t = useTranslations('bailleur');
  const [mapReady, setMapReady]       = useState(false);
  const [step, setStep]               = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(() => z.object({
    title:         z.string().min(5, t('zTitleTooShort')),
    description:   z.string().min(20, t('zDescTooShort')),
    type:          z.enum(LISTING_TYPES),
    rentalMode:      z.enum(RENTAL_MODES),
    price:           z.number().positive(t('zPricePositive')).optional(),
    pricePerNight:   z.number().positive(t('zPriceNightPositive')).optional(),
    minimumNights:   z.number().int().min(1, t('zMinNights')).optional(),
    maximumNights:   z.number().int().min(1, t('zMaxNights')).optional(),
    cleaningFee:     z.number().min(0).optional(),
    depositMonths:   z.number().int().min(0, t('zDepositRequired')).optional(),
    chargesIncluded: z.boolean().optional(),
    minLeaseMonths:  z.number().int().min(1).optional(),
    lat:           z.number(),
    lng:           z.number(),
    address:       z.string().min(5, t('zAddressShort')),
    city:          z.string().min(2, t('zCityShort')),
    region:        z.string().min(2, t('zRegionShort')),
    surface:       z.number().positive(t('zSurfacePositive')).optional(),
    rooms:         z.number().int(t('zRoomsInt')).min(0, t('zRoomsMin')).optional(),
    beds:          z.number().int(t('zBedsInt')).min(0, t('zBedsMin')).optional(),
    baths:         z.number().int(t('zBathsInt')).min(0, t('zBathsMin')).optional(),
    amenities:     z.array(z.string()).default([]),
    images:        z.array(z.string()).min(1, t('zImageRequired')),
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
    // En mode MIXTE, la durée minimale du bail définit le seuil nuitée/mensuel.
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
  }), [t]);

  type FormValues = z.infer<typeof schema>;

  const FIELD_LABELS = useMemo((): Record<string, string> => ({
    title:         t('fieldTitle'),
    description:   t('fieldDescription'),
    type:          t('fieldType'),
    rentalMode:      t('rentalModeLabel'),
    price:           t('fieldPrice'),
    pricePerNight:   t('fieldPriceNight'),
    minimumNights:   t('fieldMinNights'),
    maximumNights:   t('fieldMaxNights'),
    cleaningFee:     t('fieldCleaningFee'),
    depositMonths:   t('fieldDepositMonths'),
    chargesIncluded: t('fieldChargesIncluded'),
    minLeaseMonths:  t('fieldMinLeaseMonths'),
    lat:           'Latitude',
    lng:           'Longitude',
    address:       t('fieldAddress'),
    city:          t('fieldCity'),
    region:        t('fieldRegion'),
    surface:       t('fieldSurface'),
    rooms:         t('fieldRooms'),
    beds:          t('fieldBeds'),
    baths:         t('fieldBaths'),
    amenities:     t('fieldAmenities'),
    images:        t('fieldImages'),
  }), [t]);

  const STEPS = useMemo(() => [
    { label: t('stepBasicInfo'),       fields: ['title', 'description', 'type', 'rentalMode', 'price', 'pricePerNight', 'minimumNights', 'maximumNights', 'cleaningFee', 'depositMonths', 'chargesIncluded', 'minLeaseMonths'], icon: 'fa-tag' },
    { label: t('stepLocation'),         fields: ['address', 'city', 'region', 'lat', 'lng'], icon: 'fa-location-dot' },
    { label: t('stepDetails'),          fields: ['surface', 'rooms', 'beds', 'baths'], icon: 'fa-list-check' },
    { label: t('stepAmenitiesPhotos'),  fields: ['amenities', 'images'], icon: 'fa-images' },
    { label: t('stepReview'),           fields: [], icon: 'fa-eye' },
  ] as { label: string; fields: string[]; icon: string }[], [t]);

  const AMENITIES = useMemo(() => AMENITY_KEYS.map((a) => ({ key: a.key, icon: a.icon, label: t(a.tKey as Parameters<typeof t>[0]) })), [t]);

  const TYPE_META = useMemo(() => ({
    APPARTEMENT: { icon: TYPE_ICONS.APPARTEMENT, label: t('typeAppartement') },
    VILLA:       { icon: TYPE_ICONS.VILLA,       label: t('typeVilla')       },
    STUDIO:      { icon: TYPE_ICONS.STUDIO,      label: t('typeStudio')      },
    CHAMBRE:     { icon: TYPE_ICONS.CHAMBRE,     label: t('typeChambre')     },
    BUREAU:      { icon: TYPE_ICONS.BUREAU,      label: t('typeBureau')      },
  }), [t]);

  const {
    register, handleSubmit, reset, setValue, watch, trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    mode: 'onBlur',
  });

  const resetRef = useRef(reset);
  useEffect(() => { resetRef.current = reset; });

  // eslint-disable-next-line react-hooks/incompatible-library
  const lat         = watch('lat');
  const lng         = watch('lng');
  const amenities   = watch('amenities') ?? [];
  const images      = watch('images') ?? [];
  const description = watch('description') ?? '';
  const type        = watch('type');
  const rentalMode  = watch('rentalMode');
  const priceWatch  = watch('price');
  const depositMonthsWatch = watch('depositMonths');
  const minLeaseMonthsWatch = watch('minLeaseMonths');
  // Snapshot complet du formulaire — uniquement pour l'étape Récapitulatif
  // (les watch() ciblés ci-dessus restent la source pour le reste du form).
  const allValues = watch();

  const RENTAL_MODE_META = useMemo(() => ({
    NIGHTLY: { icon: 'fa-moon',          label: t('rentalModeNightly'), desc: t('rentalModeNightlyDesc') },
    MONTHLY: { icon: 'fa-calendar-days', label: t('rentalModeMonthly'), desc: t('rentalModeMonthlyDesc') },
    MIXED:   { icon: 'fa-shuffle',       label: t('rentalModeMixed'),   desc: t('rentalModeMixedDesc')  },
  }), [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (!cancelled) { setLoadError(t('editLoadError')); setLoadingData(false); }
        return;
      }
      try {
        const listing = await api.get<Listing>(`/listings/${id}`, token);
        if (cancelled) return;
        resetRef.current({
          title:         listing.title,
          description:   listing.description,
          type:          listing.type,
          rentalMode:      listing.rentalMode ?? 'MONTHLY',
          price:         typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price,
          pricePerNight: listing.pricePerNight != null
            ? (typeof listing.pricePerNight === 'string' ? parseFloat(listing.pricePerNight) : listing.pricePerNight)
            : undefined,
          minimumNights: listing.minimumNights ?? undefined,
          maximumNights: listing.maximumNights ?? undefined,
          cleaningFee: listing.cleaningFee != null
            ? (typeof listing.cleaningFee === 'string' ? parseFloat(listing.cleaningFee) : listing.cleaningFee)
            : undefined,
          depositMonths:   listing.depositMonths ?? undefined,
          chargesIncluded: listing.chargesIncluded ?? undefined,
          minLeaseMonths:  listing.minLeaseMonths ?? undefined,
          lat:           listing.lat,
          lng:           listing.lng,
          address:       listing.address ?? '',
          city:          listing.city,
          region:        listing.region,
          surface:       listing.surface ?? undefined,
          rooms:         listing.rooms ?? undefined,
          beds:          listing.beds ?? undefined,
          baths:         listing.baths ?? undefined,
          amenities:     listing.amenities ?? [],
          images:        listing.images ?? [],
        });
        setMapReady(true);
        setLoadingData(false);
      } catch {
        if (!cancelled) {
          setLoadError(t('editLoadError'));
          setLoadingData(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getToken]);

  const stepFields = STEPS[step].fields;
  const stepErrors = stepFields
    .filter((f) => errors[f as keyof FormValues])
    .map((f) => ({ field: f, label: FIELD_LABELS[f] ?? f, message: errors[f as keyof FormValues]?.message as string }));

  async function goNext() {
    const valid = await trigger(stepFields as (keyof FormValues)[]);
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      (document.activeElement as HTMLElement)?.blur();
    }
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(values: FormValues) {
    const token = await getToken();
    if (!token) return;
    try {
      await api.patch(`/listings/${id}`, values, token);
      router.push('/bailleur/listings');
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('editSaveError'));
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-2xl text-red-400 mb-3" />
        <p className="text-sm text-sub">{loadError}</p>
        <button onClick={() => router.push('/bailleur/listings')} className="mt-4 btn-gold text-sm">
          <i className="fa-solid fa-arrow-left mr-1.5" />{t('editBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('editPageTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('editPageSub')}</p>
      </div>

      <StepIndicator current={step} steps={STEPS} />

      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5">
        {stepErrors.length > 0 && (
          <div className="rounded-xl border border-gold-dark/30 bg-gold-pale/40 p-4">
            <p className="text-sm font-semibold text-text mb-1.5">
              <i className="fa-solid fa-triangle-exclamation text-gold-dark mr-1.5" />
              {t('stepErrorsTitle')}
            </p>
            <ul className="ml-5 space-y-0.5 text-sm text-sub">
              {stepErrors.map((e) => (
                <li key={e.field}>• {e.label} : {e.message}</li>
              ))}
            </ul>
          </div>
        )}

        {step === 0 && (
          <>
            <Field label={t('fieldTitle')} error={errors.title?.message}>
              <input {...register('title')} placeholder={t('fieldTitlePh')} className="input-field" />
            </Field>

            <Field label={t('fieldDescription')} error={errors.description?.message}>
              <textarea {...register('description')} rows={4} placeholder={t('fieldDescPh')} className="input-field resize-none" />
              <p className="mt-1 text-right text-xs text-sub">{t('fieldCharCount', { count: description.length })}</p>
            </Field>

            <div>
              <FieldLabel label={t('fieldType')} />
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {LISTING_TYPES.map((tp) => {
                  const active = type === tp;
                  const meta   = TYPE_META[tp];
                  return (
                    <button key={tp} type="button" onClick={() => setValue('type', tp)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                        active ? 'border-gold bg-gold-pale ring-2 ring-gold/30' : 'border-line bg-bg hover:border-gold/40'
                      }`}>
                      <i className={`fa-solid ${TYPE_ICONS[tp]} text-xl ${active ? 'text-gold-dark' : 'text-sub'}`} />
                      <span className={`text-[11px] font-semibold ${active ? 'text-gold-dark' : 'text-sub'}`}>
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel label={t('rentalModeLabel')} />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {RENTAL_MODES.map((mode) => {
                  const active = rentalMode === mode;
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

            {(rentalMode === 'MONTHLY' || rentalMode === 'MIXED') && (
              <div className="rounded-xl border border-line bg-bg/60 p-4 space-y-4">
                <p className="text-xs font-semibold text-sub uppercase tracking-wide">
                  <i className="fa-solid fa-calendar-days mr-1.5 text-gold-dark" />
                  {t('monthlyTitle')}
                </p>
                {rentalMode === 'MIXED' && (
                  <p className="text-xs text-sub">
                    {Number(minLeaseMonthsWatch) > 0
                      ? t('monthlyThresholdNote', { months: Number(minLeaseMonthsWatch) })
                      : t('monthlyThresholdNoteGeneric')}
                  </p>
                )}
                <Field label={t('fieldPrice')} error={errors.price?.message}>
                  <div className="relative">
                    <input
                      type="number"
                      {...register('price', { setValueAs: asNumberOrUndefined })}
                      placeholder="350000"
                      className="input-field pr-24"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">{t('fcfaPerMonth')}</span>
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('fieldDepositMonths')} error={errors.depositMonths?.message}>
                    <input type="number" min={0} {...register('depositMonths', { setValueAs: asNumberOrUndefined })}
                      placeholder="2" className="input-field" />
                  </Field>
                  <Field label={t('fieldMinLeaseMonths')} error={errors.minLeaseMonths?.message} required={rentalMode === 'MIXED'}>
                    <input type="number" min={1} {...register('minLeaseMonths', { setValueAs: asNumberOrUndefined })}
                      placeholder="12" className="input-field" />
                  </Field>
                </div>

                {Number(priceWatch) > 0 && Number(depositMonthsWatch) > 0 && (() => {
                  const rent = Number(priceWatch);
                  const brokerFee = Math.round(rent);
                  const landlordDeposit = Math.max(0, Math.round(rent * Number(depositMonthsWatch)) - brokerFee);
                  return (
                    <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 px-3.5 py-3 text-xs text-blue-800">
                      <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
                      <span>
                        {t('depositCommissionNote', {
                          fee: brokerFee.toLocaleString('fr-FR'),
                          net: landlordDeposit.toLocaleString('fr-FR'),
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

            {(rentalMode === 'NIGHTLY' || rentalMode === 'MIXED') && (
              <div className="rounded-xl border border-line bg-bg/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-sub uppercase tracking-wide">
                  <i className="fa-solid fa-moon mr-1.5 text-gold-dark" />
                  {t('shortStayTitle')}
                </p>
                <p className="text-xs text-sub">{t('shortStayDesc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('fieldPriceNight')} error={errors.pricePerNight?.message}>
                    <div className="relative">
                      <input
                        type="number"
                        {...register('pricePerNight', { setValueAs: asNumberOrUndefined })}
                        placeholder="15000"
                        className="input-field pr-24"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">{t('fcfaPerNight')}</span>
                    </div>
                  </Field>
                  <Field label={t('fieldMinNights')} error={errors.minimumNights?.message}>
                    <input
                      type="number"
                      min={1}
                      {...register('minimumNights', { setValueAs: asNumberOrUndefined })}
                      placeholder="2"
                      className="input-field"
                    />
                  </Field>
                </div>

                {rentalMode === 'NIGHTLY' && (
                  <div>
                    <Field label={t('fieldMaxNights')} error={errors.maximumNights?.message}>
                      <input
                        type="number"
                        min={1}
                        {...register('maximumNights', { setValueAs: asNumberOrUndefined })}
                        placeholder="30"
                        className="input-field"
                      />
                    </Field>
                    <p className="mt-1.5 text-xs text-sub">{t('fieldMaxNightsDesc')}</p>
                  </div>
                )}

                <Field label={t('fieldCleaningFee')} error={errors.cleaningFee?.message}>
                  <div className="relative">
                    <input type="number" min={0} {...register('cleaningFee', { setValueAs: asNumberOrUndefined })}
                      placeholder="5000" className="input-field pr-16" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">FCFA</span>
                  </div>
                </Field>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t('fieldAddress')} error={errors.address?.message}>
              <input {...register('address')} placeholder={t('fieldAddressPh')} className="input-field" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('fieldCity')} error={errors.city?.message}>
                <input {...register('city')} placeholder={t('fieldCityPh')} className="input-field" />
              </Field>
              <Field label={t('fieldRegion')} error={errors.region?.message}>
                <select {...register('region')} className="input-field">
                  <option value="">{t('fieldRegionDefault')}</option>
                  {SENEGAL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <div>
              <FieldLabel label={t('fieldMapPosition')} />
              <div className="h-64 overflow-hidden rounded-xl border border-line">
                {mapReady && lat != null && lng != null ? (
                  <LocationPicker
                    defaultLat={lat}
                    defaultLng={lng}
                    onChange={(la, ln) => { setValue('lat', la); setValue('lng', ln); }}
                  />
                ) : (
                  <div className="w-full h-full bg-bg animate-pulse rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-map-location-dot text-2xl text-sub/30" />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-sub">
                <i className="fa-solid fa-location-crosshairs mr-1 text-gold-dark" />
                {t('fieldCoords', { lat: (lat ?? 0).toFixed(4), lng: (lng ?? 0).toFixed(4) })}
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label={t('fieldSurface')} error={errors.surface?.message}>
              <input type="number" {...register('surface', { setValueAs: asNumberOrUndefined })} placeholder="85" className="input-field" />
            </Field>
            <Field label={t('fieldRooms')} error={errors.rooms?.message}>
              <input type="number" {...register('rooms', { setValueAs: asNumberOrUndefined })} placeholder="3" className="input-field" />
            </Field>
            <Field label={t('fieldBeds')} error={errors.beds?.message}>
              <input type="number" {...register('beds', { setValueAs: asNumberOrUndefined })} placeholder="2" className="input-field" />
            </Field>
            <Field label={t('fieldBaths')} error={errors.baths?.message}>
              <input type="number" {...register('baths', { setValueAs: asNumberOrUndefined })} placeholder="1" className="input-field" />
            </Field>
          </div>
        )}

        {step === 3 && (
          <>
            <div>
              <FieldLabel label={t('fieldAmenities')} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AMENITIES.map(({ key, icon, label }) => {
                  const active = amenities.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setValue(
                          'amenities',
                          active ? amenities.filter((a) => a !== key) : [...amenities, key],
                        )
                      }
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                        active
                          ? 'border-gold bg-gold-pale text-gold-dark'
                          : 'border-line bg-bg text-sub hover:border-gold/40'
                      }`}
                    >
                      <i className={`fa-solid ${icon} text-sm shrink-0`} />
                      <span className="font-medium">{label}</span>
                      {active && <i className="fa-solid fa-check ml-auto text-[10px]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel label={t('fieldImages')} />
              <ImageUploadZone
                images={images}
                onChange={(imgs) => setValue('images', imgs, { shouldValidate: true })}
                getToken={getToken}
              />
              {errors.images && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <i className="fa-solid fa-circle-exclamation" /> {errors.images.message}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Étape 4 : Récapitulatif ── */}
        {step === 4 && (
          <>
            <StepHeader title={t('reviewTitle')} sub={t('reviewSubtitle')} />
            <RecapCard values={allValues} typeMeta={TYPE_META} amenitiesList={AMENITIES} />
          </>
        )}

        {submitError && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-sub hover:text-text disabled:opacity-40 transition"
          >
            <i className="fa-solid fa-arrow-left mr-1.5" />{t('editBack')}
          </button>

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => void goNext()} className="btn-gold">
              {t('editNext')} <i className="fa-solid fa-arrow-right ml-1.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit(onSubmit)()}
              className="btn-gold disabled:opacity-50"
            >
              {isSubmitting
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('editSaving')}</>
                : <><i className="fa-solid fa-floppy-disk" /> {t('editSave')}</>
              }
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// Même pattern visuel que publier/page.tsx (chips numérotées + libellé,
// défilement horizontal) — le champ `icon` n'est pas rendu ici non plus
// (gardé pour la même raison que côté création : cohérence de forme des
// deux tableaux STEPS/STEP_LABELS, pas un oubli).
function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: { icon: string; label: string }[];
}) {
  return (
    <div className="mb-8 flex items-center overflow-x-auto pb-1">
      {steps.map((s, i) => {
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
            {i < steps.length - 1 && (
              <div className={`mx-1 h-px w-5 transition-all ${done ? 'bg-emerald-400' : 'bg-line'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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

/* ── Récapitulatif (parité avec publier/page.tsx) ────────────────────── */

function RecapCard({
  values,
  typeMeta,
  amenitiesList,
}: {
  values: {
    type: string; title: string; description: string;
    surface?: number; rooms?: number; beds?: number; baths?: number;
    city: string; region: string; address: string;
    rentalMode: string; price?: number; pricePerNight?: number;
    depositMonths?: number; amenities?: string[]; images?: string[];
  };
  typeMeta: Record<string, { icon: string; label: string }>;
  amenitiesList: { key: string; icon: string; label: string }[];
}) {
  const t = useTranslations('bailleur');
  const amenityLabels = (values.amenities || []).map(
    (a) => amenitiesList.find((am) => am.key === a)?.label ?? a,
  );
  const meta = typeMeta[values.type];

  const recapItems = [
    { icon: 'fa-ruler-combined', label: t('fieldSurface'), value: values.surface ? `${values.surface} m²` : '—' },
    { icon: 'fa-door-open',      label: t('fieldRooms'),   value: values.rooms?.toString() || '—'            },
    { icon: 'fa-bed',            label: t('fieldBeds'),    value: values.beds?.toString() || '—'             },
    { icon: 'fa-shower',         label: t('fieldBaths'),   value: values.baths?.toString() || '—'            },
    { icon: 'fa-location-dot',   label: t('fieldCity'),    value: values.city || '—'                         },
    { icon: 'fa-map',            label: t('fieldRegion'),  value: values.region || '—'                       },
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
              {Number(values.price).toLocaleString('fr-FR')}
              <span className="ml-1 text-sm font-semibold text-sub"> {t('fcfaPerMonth')}</span>
            </span>
          )}
          {(values.rentalMode === 'NIGHTLY' || values.rentalMode === 'MIXED') && Number(values.pricePerNight) > 0 && (
            <span className="block text-xs font-semibold text-sub">
              {Number(values.pricePerNight).toLocaleString('fr-FR')} {t('fcfaPerNight')}
            </span>
          )}
          {(values.rentalMode === 'MONTHLY' || values.rentalMode === 'MIXED') && values.depositMonths !== undefined && (
            <span className="block text-xs font-semibold text-sub">
              {t('fieldDepositMonths')} : {values.depositMonths} {t('monthsShort')}
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
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sub">{t('fieldAmenities')}</p>
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
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sub">{t('fieldImages')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {values.images!.map((url, i) => (
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

