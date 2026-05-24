'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;

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
  rooms:       z.number().int().positive().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewListingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lat: 14.6937, lng: -17.4441 },
  });

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
          <input {...register('title')} placeholder="Ex : Appartement 3 pièces meublé" className={inputCls} />
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea {...register('description')} rows={4} placeholder="Décrivez votre bien..." className={inputCls} />
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

        <Field label="Adresse complète" error={errors.address?.message}>
          <input {...register('address')} placeholder="Rue, numéro..." className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ville" error={errors.city?.message}>
            <input {...register('city')} placeholder="Ex : Dakar" className={inputCls} />
          </Field>
          <Field label="Région" error={errors.region?.message}>
            <input {...register('region')} placeholder="Ex : Dakar" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Latitude" error={errors.lat?.message}>
            <input type="number" step="any" {...register('lat', { valueAsNumber: true })} className={inputCls} />
          </Field>
          <Field label="Longitude" error={errors.lng?.message}>
            <input type="number" step="any" {...register('lng', { valueAsNumber: true })} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Surface (m²)">
            <input type="number" {...register('surface', { valueAsNumber: true })} placeholder="Ex : 85" className={inputCls} />
          </Field>
          <Field label="Nombre de pièces">
            <input type="number" {...register('rooms', { valueAsNumber: true })} placeholder="Ex : 3" className={inputCls} />
          </Field>
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
