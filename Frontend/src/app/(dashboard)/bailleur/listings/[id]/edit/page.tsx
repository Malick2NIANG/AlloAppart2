'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Listing } from '@/types';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const LISTING_TYPES = ['APPARTEMENT', 'VILLA', 'STUDIO', 'CHAMBRE', 'BUREAU'] as const;
const LISTING_STATUSES = ['DRAFT', 'ACTIVE', 'RENTED', 'SUSPENDED'] as const;

const schema = z.object({
  title:       z.string().min(5, 'Titre trop court'),
  description: z.string().min(20, 'Description trop courte'),
  type:        z.enum(LISTING_TYPES),
  status:      z.enum(LISTING_STATUSES),
  price:       z.number().positive('Prix invalide'),
  lat:         z.number(),
  lng:         z.number(),
  address:     z.string().min(5),
  city:        z.string().min(2),
  region:      z.string().min(2),
  surface:     z.number().positive().optional().or(z.nan().transform(() => undefined)),
  rooms:       z.number().int().positive().optional().or(z.nan().transform(() => undefined)),
  beds:        z.number().int().positive().optional().or(z.nan().transform(() => undefined)),
  baths:       z.number().int().positive().optional().or(z.nan().transform(() => undefined)),
});

type FormValues = z.infer<typeof schema>;

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     'Brouillon',
  ACTIVE:    'Active (publiée)',
  RENTED:    'Louée',
  SUSPENDED: 'Suspendue',
};

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isLoading },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    getToken().then(async (token) => {
      if (!token) return;
      const listing = await api.get<Listing>(`/listings/${id}`, token);
      setImages(listing.images ?? []);
      reset({
        title:       listing.title,
        description: listing.description,
        type:        listing.type,
        status:      listing.status,
        price:       typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price,
        lat:         listing.lat,
        lng:         listing.lng,
        address:     listing.address ?? '',
        city:        listing.city,
        region:      listing.region,
        surface:     listing.surface ?? undefined,
        rooms:       listing.rooms ?? undefined,
        beds:        listing.beds ?? undefined,
        baths:       listing.baths ?? undefined,
      });
    });
  }, [id, getToken, reset]);

  async function onSubmit(values: FormValues) {
    const token = await getToken();
    if (!token) return;
    await api.patch(`/listings/${id}`, { ...values, images }, token);
    router.push('/bailleur/listings');
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-gold-dark" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Modifier l&apos;annonce</h1>
        <p className="mt-1 text-sm text-sub">Mettez à jour les informations de votre bien.</p>
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
          <Field label="Statut" error={errors.status?.message}>
            <select {...register('status')} className={inputCls}>
              {LISTING_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Prix mensuel (XOF)" error={errors.price?.message}>
          <input
            type="number"
            {...register('price', { valueAsNumber: true })}
            placeholder="Ex : 350000"
            className={inputCls}
          />
        </Field>

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Surface (m²)">
            <input
              type="number"
              {...register('surface', { valueAsNumber: true })}
              placeholder="85"
              className={inputCls}
            />
          </Field>
          <Field label="Pièces">
            <input
              type="number"
              {...register('rooms', { valueAsNumber: true })}
              placeholder="3"
              className={inputCls}
            />
          </Field>
          <Field label="Chambres">
            <input
              type="number"
              {...register('beds', { valueAsNumber: true })}
              placeholder="2"
              className={inputCls}
            />
          </Field>
          <Field label="SDB">
            <input
              type="number"
              {...register('baths', { valueAsNumber: true })}
              placeholder="1"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Latitude" error={errors.lat?.message}>
            <input
              type="number"
              step="any"
              {...register('lat', { valueAsNumber: true })}
              className={inputCls}
            />
          </Field>
          <Field label="Longitude" error={errors.lng?.message}>
            <input
              type="number"
              step="any"
              {...register('lng', { valueAsNumber: true })}
              className={inputCls}
            />
          </Field>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">Photos</label>
          <ImageUploadZone images={images} onChange={setImages} getToken={getToken} />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/bailleur/listings')}
            className="flex-1 rounded-xl border border-line bg-bg py-2.5 text-sm font-medium text-sub hover:text-text transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 btn-gold justify-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Enregistrement...</>
            ) : (
              <><i className="fa-solid fa-floppy-disk" /> Enregistrer</>
            )}
          </button>
        </div>
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
