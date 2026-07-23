'use client';

import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import LocationPicker from '@/components/map/LocationPicker';
import type { User } from '@/types';

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;

const AMENITIES = [
  { key: 'wifi',       icon: 'fa-wifi',         label: 'Wi-Fi'             },
  { key: 'clim',       icon: 'fa-snowflake',     label: 'Climatisation'     },
  { key: 'tv',         icon: 'fa-tv',            label: 'Television'        },
  { key: 'cuisine',    icon: 'fa-utensils',      label: 'Cuisine equipee'   },
  { key: 'douche',     icon: 'fa-shower',        label: 'Douche / SdB'      },
  { key: 'gardien',    icon: 'fa-shield-halved', label: 'Gardiennage'       },
  { key: 'parking',    icon: 'fa-car',           label: 'Parking'           },
  { key: 'piscine',    icon: 'fa-water',         label: 'Piscine'           },
  { key: 'balcon',     icon: 'fa-door-open',     label: 'Balcon / Terrasse' },
  { key: 'generateur', icon: 'fa-bolt',          label: 'Generateur'        },
];

const asNumberOrUndefined = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

const schema = z.object({
  title:       z.string().min(5, 'Le titre est trop court — décrivez votre bien en au moins 5 caractères'),
  description: z.string().min(20, 'La description est trop courte — détaillez votre bien en au moins 20 caractères'),
  type:        z.enum(LISTING_TYPES),
  price:       z.number().positive('Le prix doit être un nombre positif — entrez le loyer mensuel en FCFA'),
  lat:         z.number(),
  lng:         z.number(),
  address:     z.string().min(5, "L'adresse est trop courte — précisez la rue et le numéro"),
  city:        z.string().min(2, 'Indiquez une ville valide'),
  region:      z.string().min(2, 'Indiquez une région valide'),
  surface:     z.number().positive('La surface doit être un nombre positif').optional(),
  rooms:       z.number().int('Le nombre de pièces doit être un nombre entier').min(0, 'Le nombre de pièces ne peut pas être négatif').optional(),
  beds:        z.number().int('Le nombre de chambres doit être un nombre entier').min(0, 'Le nombre de chambres ne peut pas être négatif').optional(),
  baths:       z.number().int('Le nombre de SDB doit être un nombre entier').min(0, 'Le nombre de SDB ne peut pas être négatif').optional(),
  amenities:   z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

const FIELD_LABELS: Record<keyof FormValues, string> = {
  title: 'Titre',
  description: 'Description',
  type: 'Type de bien',
  price: 'Prix mensuel',
  lat: 'Latitude',
  lng: 'Longitude',
  address: 'Adresse',
  city: 'Ville',
  region: 'Région',
  surface: 'Surface',
  rooms: 'Pièces',
  beds: 'Chambres',
  baths: 'Salles de bain',
  amenities: 'Équipements',
};

const STEPS: { label: string; fields: (keyof FormValues)[] }[] = [
  { label: 'Informations de base', fields: ['title', 'description', 'type', 'price'] },
  { label: 'Localisation',         fields: ['address', 'city', 'region', 'lat', 'lng'] },
  { label: 'Détails du bien',      fields: ['surface', 'rooms', 'beds', 'baths'] },
  { label: 'Équipements & Photos', fields: ['amenities'] },
];

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
  const [images, setImages]           = useState<string[]>([]);
  const [step, setStep]               = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    .filter((f) => errors[f])
    .map((f) => ({ field: f, label: FIELD_LABELS[f], message: errors[f]?.message as string }));

  async function goNext() {
    const valid = await trigger(stepFields);
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
      setSubmitError(message || "Impossible de créer l'annonce.");
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Nouvelle annonce</h1>
        <p className="mt-1 text-sm text-sub">Renseignez les informations de votre bien.</p>
      </div>

      <StepIndicator current={step} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {stepErrors.length > 0 && (
          <div className="rounded-xl border border-gold-dark/30 bg-gold-pale/40 p-4">
            <p className="text-sm font-semibold text-text mb-1.5">
              <i className="fa-solid fa-triangle-exclamation text-gold-dark mr-1.5" />
              Veuillez corriger les champs suivants avant de continuer :
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
            <Field label="Titre" error={errors.title?.message}>
              <input {...register('title')} placeholder="Ex : Appartement 3 pieces meuble" className={inputCls(!!errors.title)} />
            </Field>

            <Field label="Description" error={errors.description?.message}>
              <textarea {...register('description')} rows={4} placeholder="Decrivez votre bien..." className={inputCls(!!errors.description)} />
              <p className="mt-1 text-right text-xs text-sub">{description.length} caractères</p>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type de bien" error={errors.type?.message}>
                <select {...register('type')} className={inputCls(!!errors.type)}>
                  {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Prix mensuel" error={errors.price?.message}>
                <div className="relative">
                  <input
                    type="number"
                    {...register('price', { setValueAs: asNumberOrUndefined })}
                    placeholder="Ex : 350000"
                    className={`${inputCls(!!errors.price)} pr-20`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sub">FCFA/mois</span>
                </div>
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Adresse complete" error={errors.address?.message}>
              <input {...register('address')} placeholder="Rue, numero..." className={inputCls(!!errors.address)} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ville" error={errors.city?.message}>
                <input {...register('city')} placeholder="Ex : Dakar" className={inputCls(!!errors.city)} />
              </Field>
              <Field label="Region" error={errors.region?.message}>
                <input {...register('region')} placeholder="Ex : Dakar" className={inputCls(!!errors.region)} />
              </Field>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Position sur la carte</label>
              <div className="h-64 overflow-hidden rounded-xl border border-line">
                <LocationPicker
                  defaultLat={lat ?? 14.6937}
                  defaultLng={lng ?? -17.4441}
                  onChange={(la, ln) => { setValue('lat', la); setValue('lng', ln); }}
                />
              </div>
              <p className="mt-1 text-xs text-sub">
                <i className="fa-solid fa-location-crosshairs mr-1 text-gold-dark" />
                Lat : {lat?.toFixed(4)} - Lng : {lng?.toFixed(4)}
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Surface (m2)" error={errors.surface?.message}>
              <input type="number" {...register('surface', { setValueAs: asNumberOrUndefined })} placeholder="85" className={inputCls(!!errors.surface)} />
            </Field>
            <Field label="Pieces" error={errors.rooms?.message}>
              <input type="number" {...register('rooms', { setValueAs: asNumberOrUndefined })} placeholder="3" className={inputCls(!!errors.rooms)} />
            </Field>
            <Field label="Chambres" error={errors.beds?.message}>
              <input type="number" {...register('beds', { setValueAs: asNumberOrUndefined })} placeholder="2" className={inputCls(!!errors.beds)} />
            </Field>
            <Field label="SDB" error={errors.baths?.message}>
              <input type="number" {...register('baths', { setValueAs: asNumberOrUndefined })} placeholder="1" className={inputCls(!!errors.baths)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-text">Equipements</label>
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
              <label className="mb-1.5 block text-sm font-medium text-text">Photos</label>
              <ImageUploadZone images={images} onChange={setImages} getToken={getToken} />
            </div>

            <Summary watch={watch} onEdit={setStep} />
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
            <i className="fa-solid fa-arrow-left mr-1.5" />Retour
          </button>

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => void goNext()} className="btn-gold">
              Suivant <i className="fa-solid fa-arrow-right ml-1.5" />
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting} className="btn-gold disabled:opacity-50">
              {isSubmitting
                ? <><i className="fa-solid fa-spinner fa-spin" /> Publication...</>
                : <><i className="fa-solid fa-paper-plane" /> Publier l&apos;annonce</>
              }
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
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
          {i < STEPS.length - 1 && (
            <div className={`mx-2 h-0.5 flex-1 ${i < current ? 'bg-gold-dark' : 'bg-line'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Summary({ watch, onEdit }: { watch: (name: keyof FormValues) => unknown; onEdit: (step: number) => void }) {
  const title  = (watch('title') as string) || '—';
  const type   = (watch('type') as string) || '—';
  const price  = watch('price') as number | undefined;
  const city   = (watch('city') as string) || '—';
  const region = (watch('region') as string) || '—';

  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sub">
        <i className="fa-solid fa-clipboard-check mr-1.5 text-gold-dark" />
        Relisez votre annonce avant de publier
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-sub">Informations de base</p>
          <p className="mt-0.5 truncate text-sm text-text">
            {title} · {type} · {price ? `${price.toLocaleString('fr-FR')} FCFA/mois` : '—'}
          </p>
        </div>
        <button type="button" onClick={() => onEdit(0)} className="shrink-0 text-xs font-medium text-gold-dark hover:underline">
          Modifier
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0">
          <p className="text-xs text-sub">Localisation</p>
          <p className="mt-0.5 truncate text-sm text-text">{city}, {region}</p>
        </div>
        <button type="button" onClick={() => onEdit(1)} className="shrink-0 text-xs font-medium text-gold-dark hover:underline">
          Modifier
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
