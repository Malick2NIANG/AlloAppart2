'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import LocationPicker from '@/components/map/LocationPicker';

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

const schema = z.object({
  title:       z.string().min(5, 'Titre trop court'),
  description: z.string().min(20, 'Description trop courte'),
  type:        z.enum(LISTING_TYPES),
  price:       z.number().positive('Prix invalide'),
  lat:         z.number(),
  lng:         z.number(),
  address:     z.string().min(5),
  city:        z.string().min(2),
  region:      z.string().min(2),
  surface:     z.number().positive().optional(),
  rooms:       z.number().int().min(0).optional(),
  beds:        z.number().int().min(0).optional(),
  baths:       z.number().int().min(0).optional(),
  amenities:   z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

export default function NewListingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { lat: 14.6937, lng: -17.4441, amenities: [] },
  });
  const lat       = watch('lat');
  const lng       = watch('lng');
  const amenities = watch('amenities') ?? [];

  async function onSubmit(values: FormValues) {
    const token = await getToken();
    await api.post('/listings', { ...values, images }, token ?? undefined);
    router.push('/bailleur/listings');
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Nouvelle annonce</h1>
        <p className="mt-1 text-sm text-sub">Renseignez les informations de votre bien.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Titre" error={errors.title?.message}>
          <input {...register('title')} placeholder="Ex : Appartement 3 pieces meuble" className={inputCls} />
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea {...register('description')} rows={4} placeholder="Decrivez votre bien..." className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Type de bien" error={errors.type?.message}>
            <select {...register('type')} className={inputCls}>
              {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Prix mensuel (XOF)" error={errors.price?.message}>
            <input type="number" {...register('price', { valueAsNumber: true })} placeholder="Ex : 350000" className={inputCls} />
          </Field>
        </div>

        <Field label="Adresse complete" error={errors.address?.message}>
          <input {...register('address')} placeholder="Rue, numero..." className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ville" error={errors.city?.message}>
            <input {...register('city')} placeholder="Ex : Dakar" className={inputCls} />
          </Field>
          <Field label="Region" error={errors.region?.message}>
            <input {...register('region')} placeholder="Ex : Dakar" className={inputCls} />
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Surface (m2)">
            <input type="number" {...register('surface', { valueAsNumber: true })} placeholder="85" className={inputCls} />
          </Field>
          <Field label="Pieces">
            <input type="number" {...register('rooms', { valueAsNumber: true })} placeholder="3" className={inputCls} />
          </Field>
          <Field label="Chambres">
            <input type="number" {...register('beds', { valueAsNumber: true })} placeholder="2" className={inputCls} />
          </Field>
          <Field label="SDB">
            <input type="number" {...register('baths', { valueAsNumber: true })} placeholder="1" className={inputCls} />
          </Field>
        </div>

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

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-gold mt-2 justify-center disabled:opacity-50"
        >
          {isSubmitting
            ? <><i className="fa-solid fa-spinner fa-spin" /> Publication...</>
            : <><i className="fa-solid fa-paper-plane" /> Publier l&apos;annonce</>
          }
        </button>
      </form>
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-text placeholder:text-sub outline-none focus:border-gold focus:ring-1 focus:ring-gold transition';

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
