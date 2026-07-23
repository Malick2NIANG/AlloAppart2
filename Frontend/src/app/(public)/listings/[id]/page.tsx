import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import ListingHeroCarousel from './ListingHeroCarousel';
import ListingContactCard from './ListingContactCard';
import ListingBookingCard from './ListingBookingCard';
import ListingReviewForm from './ListingReviewForm';
import MapView from '@/components/map/MapView';
import AvailabilityCalendar from '@/components/listings/AvailabilityCalendar';
import AlloVerifieBadge from '@/components/ui/AlloVerifieBadge';
import { type Listing, priceToNumber, ownerFullName } from '@/types/listing';

const AMENITY_ICONS: Record<string, string> = {
  wifi: 'fa-wifi', clim: 'fa-snowflake', tv: 'fa-tv',
  cuisine: 'fa-utensils', douche: 'fa-shower', gardien: 'fa-shield-halved',
};

const AMENITY_LABELS: Record<string, Record<string, string>> = {
  wifi:    { fr: 'Wi-Fi',           en: 'Wi-Fi'           },
  clim:    { fr: 'Climatisation',   en: 'Air conditioning' },
  tv:      { fr: 'Télévision',      en: 'Television'       },
  cuisine: { fr: 'Cuisine équipée', en: 'Equipped kitchen' },
  douche:  { fr: 'Douche/Bain',     en: 'Shower/Bath'      },
  gardien: { fr: 'Gardiennage 24h', en: '24h security'     },
};


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const { api } = await import('@/lib/api');
    const listing = await api.get<Listing>(`/listings/${id}`);
    const image = listing.images?.[0];
    return {
      title: `${listing.title} — AlloAppart`,
      description: listing.description?.slice(0, 155) ?? `${listing.type} à ${listing.city}`,
      openGraph: {
        title: listing.title,
        description: listing.description?.slice(0, 155) ?? `${listing.type} à ${listing.city}`,
        images: image ? [{ url: image, width: 1200, height: 630, alt: listing.title }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: listing.title,
        description: listing.description?.slice(0, 155) ?? `${listing.type} à ${listing.city}`,
        images: image ? [image] : [],
      },
    };
  } catch {
    return { title: 'Annonce — AlloAppart' };
  }
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale] = await Promise.all([getTranslations('detail'), getLocale()]);
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';

  let listing: Listing | null = null;
  let similar: Listing[] = [];
  try {
    const { api } = await import('@/lib/api');
    const [data, sim] = await Promise.all([
      api.get<Listing>(`/listings/${id}`),
      api.get<Listing[]>(`/listings/${id}/similar`).catch(() => [] as Listing[]),
    ]);
    listing = data;
    similar = Array.isArray(sim) ? sim : [];
  } catch {
    notFound();
  }

  if (!listing) notFound();

  const price = `${priceToNumber(listing.price).toLocaleString(numLocale)} FCFA/${t('perMonth')}`;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const isNew = (now - new Date(listing.createdAt).getTime()) < 10 * 24 * 60 * 60 * 1000;

  const CARD = 'bg-white/70 backdrop-blur-xl border border-line rounded-3xl p-6 md:p-8 shadow-lg';

  return (
    <main className="pb-24 md:pb-10">

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="aa-container mt-6 mb-5">
        <nav className="flex items-center gap-1.5 text-sm text-sub flex-wrap">
          <Link href="/" className="hover:text-gold-dark transition-colors">{t('breadcrumbHome')}</Link>
          <span className="text-sub/50">/</span>
          <Link href="/listings" className="hover:text-gold-dark transition-colors">{listing.city.split(',')[0]}</Link>
          <span className="text-sub/50">/</span>
          <span className="font-medium text-text max-w-[50vw] truncate">{listing.title}</span>
        </nav>
      </div>

      {/* ── Hero Carousel ──────────────────────────────────────────── */}
      <div className="aa-container">
        <ListingHeroCarousel
          images={listing.images}
          title={listing.title}
          city={listing.city}
          price={price}
          listingId={id}
        />
      </div>

      {/* ── Visite 3D AlloVérifié ─────────────────────────────────── */}
      {listing.tourUrl && (
        <div className="aa-container mt-6">
          <div className="rounded-2xl border border-line bg-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-line">
              <i className="fa-solid fa-cube text-gold-dark text-sm" aria-hidden="true" />
              <span className="text-sm font-semibold text-text">Visite 3D</span>
              <span className="ml-0.5 text-xs font-semibold text-gold-dark">AlloVérifié™</span>
              <span className="ml-auto text-[10px] bg-gold-pale text-gold-dark px-2 py-0.5 rounded-full font-medium">
                Nouveau
              </span>
            </div>
            <iframe
              src={listing.tourUrl}
              className="w-full"
              style={{ height: '420px', border: 'none' }}
              allow="xr-spatial-tracking"
              allowFullScreen
              title="Visite 3D du bien"
            />
          </div>
        </div>
      )}

      {/* ── Content Grid ───────────────────────────────────────────── */}
      <div className="aa-container grid lg:grid-cols-3 gap-8">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">

          {/* About */}
          <div className={CARD}>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <h2 className="text-xl md:text-2xl font-semibold text-text">{t('about')}</h2>
              <div className="flex gap-2 flex-wrap">
                {isNew && (
                  <span className="bg-gold-pale text-gold-dark border border-gold/50 px-2.5 py-1 text-xs rounded-full font-medium">
                    {t('newBadge')}
                  </span>
                )}
                {listing.isVerified && (
                  <AlloVerifieBadge className="px-3 py-1 text-xs" />
                )}
              </div>
            </div>

            {/* Characteristics */}
            <div className="mt-5 grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {[
                { icon: 'fa-bed',            value: listing.beds,                           label: t('beds')    },
                { icon: 'fa-bath',           value: listing.baths,                          label: t('baths')   },
                { icon: 'fa-ruler-combined', value: `${listing.surface} m²`,                label: t('surface') },
                { icon: 'fa-door-open',      value: listing.rooms,                          label: t('rooms')   },
                { icon: 'fa-city',           value: listing.city,                           label: t('region')  },
                { icon: 'fa-house',          value: listing.type.charAt(0) + listing.type.slice(1).toLowerCase(), label: t('type') },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full bg-gold-pale text-gold-dark inline-grid place-items-center shrink-0">
                    <i className={`fa-solid ${item.icon} text-xs`} />
                  </span>
                  <div>
                    <p className="font-medium text-text">{String(item.value)}</p>
                    <p className="text-sub text-xs">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* AlloVérifié */}
            {listing.isVerified && listing.verification && (
              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-shield-halved text-green-700" />
                  <span className="font-semibold text-green-800 text-sm">
                    AlloVérifié — Audit {listing.verification.auditType === 'FULL' ? 'Complet' : 'Basique'}
                  </span>
                  {listing.verification.completedAt && (
                    <span className="ml-auto text-xs text-green-600">
                      {new Date(listing.verification.completedAt).toLocaleDateString('fr-SN', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                {listing.verification.notes && (
                  <p className="text-sm text-green-700 leading-relaxed">{listing.verification.notes}</p>
                )}
                {listing.verification.reportUrl && (
                  <a
                    href={listing.verification.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 underline underline-offset-2"
                  >
                    <i className="fa-solid fa-file-lines text-[10px]" />
                    Voir le rapport d&apos;audit complet
                  </a>
                )}
              </div>
            )}

            {/* Description */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-text mb-2">{t('description')}</h3>
              <p className="leading-relaxed text-sub">{listing.description}</p>
            </div>

            {/* Amenities */}
            {listing.amenities.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-text mb-3">{t('amenities')}</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm text-sub">
                  {listing.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2">
                      <i className={`fa-solid ${AMENITY_ICONS[a] ?? 'fa-check'} text-gold-dark text-xs`} />
                      <span>{AMENITY_LABELS[a]?.[locale] ?? a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button className="text-sm text-sub hover:text-gold-dark transition-colors flex items-center gap-1.5">
                <i className="fa-regular fa-flag text-xs" />
                {t('report')}
              </button>
            </div>
          </div>

          {/* Location */}
          <div className={CARD}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-text">{t('locationTitle')}</h2>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(`${listing.address} ${listing.city}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-sm text-gold-dark hover:text-gold transition-colors flex items-center gap-1">
                {t('openMaps')} <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
              </a>
            </div>
            <div className="w-full h-64 rounded-2xl overflow-hidden border border-line">
              {listing.lat && listing.lng ? (
                <MapView lat={listing.lat} lng={listing.lng} title={listing.title} />
              ) : (
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${listing.address}, ${listing.city}, Sénégal`)}&output=embed&hl=${locale}`}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${listing.address}, ${listing.city}`}
                />
              )}
            </div>
          </div>

          {/* Reviews + leave-a-review form (auth-gated) */}
          <ListingReviewForm listingId={listing.id} />

          {/* Similar listings */}
          {similar.length > 0 && (
            <div className={CARD}>
              <h2 className="text-xl font-semibold text-text mb-5">{t('similar')}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {similar.map((s) => (
                  <Link key={s.id} href={`/listings/${s.id}`}
                    className="group rounded-2xl overflow-hidden border border-line hover:shadow-lg transition bg-white/70">
                    <div className="relative h-40 overflow-hidden">
                      <Image src={s.images[0]} alt={s.title} fill
                        className="object-cover group-hover:scale-105 transition duration-500" />
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-text truncate text-sm">{s.title}</p>
                      <p className="text-xs text-sub">{s.city}</p>
                      <p className="text-gold-dark font-semibold mt-1 text-sm">
                        {priceToNumber(s.price).toLocaleString(numLocale)} FCFA/{t('perMonth')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══ SIDEBAR ══════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-6">

            {/* Price + contact + landlord */}
            <ListingContactCard
              listingId={listing.id}
              price={price}
              landlordName={ownerFullName(listing.owner)}
              perMonth={t('perMonth')}
              priceRaw={priceToNumber(listing.price)}
              numLocale={numLocale}
            />

            {/* Demande de réservation */}
            <ListingBookingCard
              listingId={listing.id}
              pricePerMonth={priceToNumber(listing.price)}
              numLocale={numLocale}
            />

            {/* Calendrier disponibilité */}
            <AvailabilityCalendar listingId={listing.id} />

            {/* Guarantees */}
            <div className="bg-white/70 backdrop-blur-xl border border-line rounded-3xl p-5 shadow">
              <h3 className="text-sm font-semibold text-text mb-3">{t('guarantees')}</h3>
              <ul className="space-y-2.5 text-sm text-sub">
                {[
                  { icon: 'fa-shield-halved', label: t('securePayment')    },
                  { icon: 'fa-comments',      label: t('messaging')        },
                  { icon: 'fa-circle-check',  label: t('verifiedListings') },
                ].map((g) => (
                  <li key={g.icon} className="flex items-center gap-2">
                    <i className={`fa-solid ${g.icon} text-gold-dark`} />
                    {g.label}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* ── Back button ────────────────────────────────────────────── */}
      <div className="aa-container mt-16 mb-10 text-center">
        <Link href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/80 backdrop-blur-md text-text font-medium text-sm px-5 py-2.5 shadow-md hover:shadow-lg hover:bg-gold-pale hover:text-gold-dark transition-all duration-300">
          <i className="fa-solid fa-arrow-left text-gold-dark group-hover:-translate-x-1 transition-transform duration-300" />
          Retour au catalogue
        </Link>
      </div>

    </main>
  );
}
