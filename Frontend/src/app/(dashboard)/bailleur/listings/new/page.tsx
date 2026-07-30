'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import LocationPicker from '@/components/map/LocationPicker';
import type { User } from '@/types';

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;

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

export default function NewListingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) { setAllowed(true); setChecking(false); return; }
      try {
        const [me, sub] = await Promise.all([
          api.get<User>('/auth/me', token),
          api.get<{ status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' } | null>('/subscriptions/me', token),
        ]);
        if (cancelled) return;
        if (me.roles.includes('PRO_AGENCE') && sub?.status !== 'ACTIVE') {
          router.replace('/bailleur/abonnement?reason=required');
          return;
        }
        setAllowed(true);
      } catch {
        if (!cancelled) setAllowed(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  if (!allowed) return null;

  return <NewListingForm />;
}

function NewListingForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const t = useTranslations('bailleur');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const [images, setImages]           = useState<string[]>([]);
  const [step, setStep]               = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(() => z.object({
    title:         z.string().min(5, t('zTitleTooShort')),
    description:   z.string().min(20, t('zDescTooShort')),
    type:          z.enum(LISTING_TYPES),
    price:         z.number().positive(t('zPricePositive')),
    pricePerNight: z.number().positive(t('zPriceNightPositive')).optional(),
    minimumNights: z.number().int().min(1, t('zMinNights')).optional(),
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
  }), [t]);

  type FormValues = z.infer<typeof schema>;

  const FIELD_LABELS = useMemo((): Record<string, string> => ({
    title:         t('fieldTitle'),
    description:   t('fieldDescription'),
    type:          t('fieldType'),
    price:         t('fieldPrice'),
    pricePerNight: t('fieldPriceNight'),
    minimumNights: t('fieldMinNights'),
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
  }), [t]);

  const STEPS = useMemo(() => [
    { label: t('stepBasicInfo'),       fields: ['title', 'description', 'type', 'price', 'pricePerNight', 'minimumNights'] },
    { label: t('stepLocation'),         fields: ['address', 'city', 'region', 'lat', 'lng'] },
    { label: t('stepDetails'),          fields: ['surface', 'rooms', 'beds', 'baths'] },
    { label: t('stepAmenitiesPhotos'),  fields: ['amenities'] },
  ] as { label: string; fields: string[] }[], [t]);

  const AMENITIES = useMemo(() => AMENITY_KEYS.map((a) => ({ key: a.key, icon: a.icon, label: t(a.tKey as Parameters<typeof t>[0]) })), [t]);

  const {
    register, handleSubmit, setValue, watch, trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    mode: 'onBlur',
    defaultValues: { lat: 14.6937, lng: -17.4441, amenities: [] },
  });

  const lat         = watch('lat');
  const lng         = watch('lng');
  const amenities   = watch('amenities') ?? [];
  const description = watch('description') ?? '';

  const stepFields = STEPS[step].fields;
  const stepErrors = stepFields
    .filter((f) => errors[f as keyof FormValues])
    .map((f) => ({ field: f, label: FIELD_LABELS[f] ?? f, message: errors[f as keyof FormValues]?.message as string }));

  async function goNext() {
    const valid = await trigger(stepFields as (keyof FormValues)[]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(values: FormValues) {
    const token = await getToken();
    try {
      await api.post('/listings', { ...values, images }, token ?? undefined);
      router.push('/bailleur/listings');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('abonnement')) {
        router.push('/bailleur/abonnement?reason=required');
        return;
      }
      setSubmitError(message || t('newCreateError'));
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{t('newPageTitle')}</h1>
        <p className="mt-1 text-sm text-sub">{t('newPageSub')}</p>
      </div>

      <StepIndicator current={step} steps={STEPS} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('fieldType')} error={errors.type?.message}>
                <select {...register('type')} className={inputCls(!!errors.type)}>
                  {LISTING_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </Field>
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
            </div>

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
            </div>
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
                <input {...register('region')} placeholder="Ex: Dakar" className={inputCls(!!errors.region)} />
              </Field>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">{t('fieldMapPosition')}</label>
              <div className="h-64 overflow-hidden rounded-xl border border-line">
                <LocationPicker
                  defaultLat={lat ?? 14.6937}
                  defaultLng={lng ?? -17.4441}
                  onChange={(la, ln) => { setValue('lat', la); setValue('lng', ln); }}
                />
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
              <ImageUploadZone images={images} onChange={setImages} getToken={getToken} />
            </div>

            <SummaryPanel watch={watch as (name: string) => unknown} onEdit={setStep} t={t} numLocale={numLocale} />
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
            <button type="submit" disabled={isSubmitting} className="btn-gold disabled:opacity-50">
              {isSubmitting
                ? <><i className="fa-solid fa-spinner fa-spin" /> {t('newPublishing')}</>
                : <><i className="fa-solid fa-paper-plane" /> {t('newPublish')}</>
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

function SummaryPanel({
  watch, onEdit, t, numLocale,
}: {
  watch: (name: string) => unknown;
  onEdit: (step: number) => void;
  t: ReturnType<typeof useTranslations<'bailleur'>>;
  numLocale: string;
}) {
  const title         = (watch('title') as string) || '—';
  const type          = (watch('type') as string) || '—';
  const price         = watch('price') as number | undefined;
  const pricePerNight = watch('pricePerNight') as number | undefined;
  const minimumNights = watch('minimumNights') as number | undefined;
  const city          = (watch('city') as string) || '—';
  const region        = (watch('region') as string) || '—';

  const priceLine = [
    price ? `${price.toLocaleString(numLocale)} ${t('fcfaPerMonth')}` : '—',
    pricePerNight ? `${pricePerNight.toLocaleString(numLocale)} ${t('fcfaPerNight')}` : null,
    minimumNights ? t('minNightsLabel', { count: minimumNights }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sub">
        <i className="fa-solid fa-clipboard-check mr-1.5 text-gold-dark" />
        {t('reviewBefore')}
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-sub">{t('stepBasicInfo')}</p>
          <p className="mt-0.5 truncate text-sm text-text">{title} · {type}</p>
          <p className="mt-0.5 truncate text-xs text-sub">{priceLine}</p>
        </div>
        <button type="button" onClick={() => onEdit(0)} className="shrink-0 text-xs font-medium text-gold-dark hover:underline">
          {t('summaryModify')}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0">
          <p className="text-xs text-sub">{t('stepLocation')}</p>
          <p className="mt-0.5 truncate text-sm text-text">{city}, {region}</p>
        </div>
        <button type="button" onClick={() => onEdit(1)} className="shrink-0 text-xs font-medium text-gold-dark hover:underline">
          {t('summaryModify')}
        </button>
      </div>
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
