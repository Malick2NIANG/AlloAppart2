import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('agences');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface AgencyCard {
  id: string;
  agencyName?: string | null;
  firstName: string;
  lastName: string;
  agencySlug?: string | null;
  avatar?: string | null;
  bio?: string | null;
  phone?: string | null;
  createdAt: string;
  _count: { listings: number };
  subscription?: { plan: string; status: string } | null;
}

async function fetchAgencies(): Promise<AgencyCard[]> {
  try {
    const res = await fetch(`${API_URL}/agences`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json() as Promise<AgencyCard[]>;
  } catch {
    return [];
  }
}

export default async function AgencesPage() {
  const [agencies, t] = await Promise.all([fetchAgencies(), getTranslations('agences')]);

  return (
    <main className="min-h-screen bg-bg py-14 px-4">
      <div className="aa-container">

        {/* En-tête */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-pale px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-gold-dark mb-3">
            <i className="fa-solid fa-building text-[9px]" /> {t('partnerBadge')}
          </span>
          <h1 className="text-3xl font-extrabold text-text md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sub">
            {agencies.length} {t(agencies.length > 1 ? 'agencesPartner' : 'agencePartner')}
          </p>
        </div>

        {/* Grille */}
        {agencies.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-20 text-center">
            <i className="fa-regular fa-building text-4xl text-sub mb-3 block" />
            <p className="font-semibold text-text">{t('emptyTitle')}</p>
            <p className="text-sm text-sub mt-1">{t('emptySub')}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {agencies.map((agency) => {
              const name  = agency.agencyName ?? `${agency.firstName} ${agency.lastName}`;
              const isPro = agency.subscription?.plan === 'PRO' && agency.subscription?.status === 'ACTIVE';
              const href  = agency.agencySlug ? `/agences/${agency.agencySlug}` : null;
              const count = agency._count.listings;
              const since = new Date(agency.createdAt).getFullYear();

              return (
                <div key={agency.id}
                  className={`group rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg ${isPro ? 'border-gold/40 hover:border-gold/70' : 'border-line hover:border-gold/30'}`}>

                  {/* Bande supérieure PRO */}
                  {isPro && <div className="h-1 w-full bg-linear-to-r from-gold to-gold-light" />}

                  <div className="p-5">
                    {/* Avatar + badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="relative">
                        {agency.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={agency.avatar} alt={name}
                            className="h-16 w-16 rounded-2xl object-cover border border-line shadow-sm" />
                        ) : (
                          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold border ${isPro ? 'bg-gold/10 border-gold/30 text-gold-dark' : 'bg-gold-pale border-line text-gold-dark'}`}>
                            {name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      {isPro && (
                        <span className="flex items-center gap-1 bg-gold/10 border border-gold/30 text-gold-dark text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <i className="fa-solid fa-crown text-[8px]" /> PRO
                        </span>
                      )}
                    </div>

                    {/* Nom */}
                    <h2 className="font-extrabold text-text text-sm leading-tight line-clamp-1 mb-1 group-hover:text-gold-dark transition-colors">
                      {name}
                    </h2>

                    {/* Bio */}
                    {agency.bio && (
                      <p className="text-xs text-sub line-clamp-2 mb-3 leading-relaxed">{agency.bio}</p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[11px] text-sub mb-4">
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-building text-gold-dark text-[10px]" />
                        <span className="font-semibold text-text">{count}</span>{' '}
                        {t(count > 1 ? 'biens' : 'bien')}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fa-regular fa-calendar text-gold-dark text-[10px]" />
                        {t('since')} {since}
                      </span>
                    </div>

                    {/* Téléphone */}
                    {agency.phone && (
                      <p className="text-[11px] text-sub flex items-center gap-1.5 mb-4">
                        <i className="fa-solid fa-phone text-gold-dark text-[10px]" />
                        {agency.phone}
                      </p>
                    )}

                    {/* CTA */}
                    {href ? (
                      <Link href={href}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold-pale hover:bg-gold/20 text-gold-dark text-xs font-semibold py-2.5 transition-colors">
                        <i className="fa-solid fa-store text-[10px]" /> {t('viewVitrine')}
                      </Link>
                    ) : (
                      <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-bg text-sub text-xs py-2.5 cursor-default">
                        {t('noVitrine')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
