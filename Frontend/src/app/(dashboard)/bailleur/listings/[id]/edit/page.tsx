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

const inputCls = (hasError: boolean) =>
  `w-full rounded-xl border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:ring-1 transition ${
    hasError ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-line focus:border-gold focus:ring-gold'
  }`;

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
    { label: t('stepBasicInfo'),       fields: ['title', 'description', 'type', 'rentalMode', 'price', 'pricePerNight', 'minimumNights', 'cleaningFee', 'depositMonths', 'chargesIncluded', 'minLeaseMonths'] },
    { label: t('stepLocation'),         fields: ['address', 'city', 'region', 'lat', 'lng'] },
    { label: t('stepDetails'),          fields: ['surface', 'rooms', 'beds', 'baths'] },
    { label: t('stepAmenitiesPhotos'),  fields: ['amenities', 'images'] },
  ] as { label: string; fields: string[] }[], [t]);

  const AMENITIES = useMemo(() => AMENITY_KEYS.map((a) => ({ key: a.key, icon: a.icon, label: t(a.tKey as Parameters<typeof t>[0]) })), [t]);

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
  const rentalMode  = watch('rentalMode');

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
              <input {...register('title')} placeholder={t('fieldTitlePh')} className={inputCls(!!errors.title)} />
            </Field>

            <Field label={t('fieldDescription')} error={errors.description?.message}>
              <textarea {...register('description')} rows={4} placeholder={t('fieldDescPh')} className={inputCls(!!errors.description)} />
              <p className="mt-1 text-right text-xs text-sub">{t('fieldCharCount', { count: description.length })}</p>
            </Field>

            <Field label={t('fieldType')} error={errors.type?.message}>
              <select {...register('type')} className={inputCls(!!errors.type)}>
                {LISTING_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </Field>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('rentalModeLabel')}</label>
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
                <Field label={t('fieldPrice')} error={errors.price?.message}>
                  <div className="relative">
                    <input
                      type="number"
                      {...register('price', { setValueAs: asNumberOrUndefined })}
                      placeholder="350000"
                      className={`${inputCls(!!errors.price)} pr-24`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">{t('fcfaPerMonth')}</span>
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('fieldDepositMonths')} error={errors.depositMonths?.message}>
                    <input type="number" min={0} {...register('depositMonths', { setValueAs: asNumberOrUndefined })}
                      placeholder="2" className={inputCls(!!errors.depositMonths)} />
                  </Field>
                  <Field label={t('fieldMinLeaseMonths')} error={errors.minLeaseMonths?.message}>
                    <input type="number" min={1} {...register('minLeaseMonths', { setValueAs: asNumberOrUndefined })}
                      placeholder="12" className={inputCls(!!errors.minLeaseMonths)} />
                  </Field>
                </div>
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
                        className={`${inputCls(!!errors.pricePerNight)} pr-24`}
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
                      className={inputCls(!!errors.minimumNights)}
                    />
                  </Field>
                </div>
                <Field label={t('fieldCleaningFee')} error={errors.cleaningFee?.message}>
                  <div className="relative">
                    <input type="number" min={0} {...register('cleaningFee', { setValueAs: asNumberOrUndefined })}
                      placeholder="5000" className={`${inputCls(!!errors.cleaningFee)} pr-16`} />
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
              <input {...register('address')} placeholder={t('fieldAddressPh')} className={inputCls(!!errors.address)} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('fieldCity')} error={errors.city?.message}>
                <input {...register('city')} placeholder={t('fieldCityPh')} className={inputCls(!!errors.city)} />
              </Field>
              <Field label={t('fieldRegion')} error={errors.region?.message}>
                <select {...register('region')} className={inputCls(!!errors.region)}>
                  <option value="">{t('fieldRegionDefault')}</option>
                  {SENEGAL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('fieldMapPosition')}</label>
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
              <input type="number" {...register('surface', { setValueAs: asNumberOrUndefined })} placeholder="85" className={inputCls(!!errors.surface)} />
            </Field>
            <Field label={t('fieldRooms')} error={errors.rooms?.message}>
              <input type="number" {...register('rooms', { setValueAs: asNumberOrUndefined })} placeholder="3" className={inputCls(!!errors.rooms)} />
            </Field>
            <Field label={t('fieldBeds')} error={errors.beds?.message}>
              <input type="number" {...register('beds', { setValueAs: asNumberOrUndefined })} placeholder="2" className={inputCls(!!errors.beds)} />
            </Field>
            <Field label={t('fieldBaths')} error={errors.baths?.message}>
              <input type="number" {...register('baths', { setValueAs: asNumberOrUndefined })} placeholder="1" className={inputCls(!!errors.baths)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-text">{t('fieldAmenities')}</label>
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
              <label className="mb-1.5 block text-sm font-medium text-text">{t('fieldImages')}</label>
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

        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
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

function StepIndicator({ current, steps }: { current: number; steps: { label: string; fields: string[] }[] }) {
  return (
    <div className="mb-8 flex items-center">
      {steps.map((step, i) => (
        <div key={step.label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
              i < current ? 'border-gold-dark bg-gold-dark text-white' :
              i === current ? 'border-gold-dark bg-gold-pale text-gold-dark' :
              'border-line bg-card text-sub'
            }`}>
              {i < current ? <i className="fa-solid fa-check text-xs" /> : i + 1}
            </div>
            <span className={`mt-1.5 max-w-20 text-center text-[11px] ${i === current ? 'font-medium text-gold-dark' : 'text-sub'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-2 h-0.5 flex-1 ${i < current ? 'bg-gold-dark' : 'bg-line'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text">{label}</label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation" /> {error}
        </p>
      )}
    </div>
  );
}

