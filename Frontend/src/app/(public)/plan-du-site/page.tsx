import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const REGIONS_SN = [
  'Dakar', 'Thiès', 'Diourbel', 'Fatick', 'Kaolack',
  'Kaffrine', 'Ziguinchor', 'Sédhiou', 'Kolda', 'Tambacounda',
  'Kédougou', 'Saint-Louis', 'Louga', 'Matam',
];

interface SitemapSectionProps {
  title: string;
  icon: string;
  links: { label: string; href: string }[];
}

function SitemapSection({ title, icon, links }: SitemapSectionProps) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gold-dark">
        <i className={`${icon} text-xs`} />
        {title}
      </h2>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex items-center gap-2 text-sm text-sub transition-colors hover:text-gold-dark group"
            >
              <i className="fa-solid fa-chevron-right text-[9px] text-gold-dark/40 group-hover:text-gold-dark transition-colors" />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PlanDuSitePage() {
  const t = await getTranslations('sitemap');

  const mainLinks     = t.raw('mainLinks')     as { label: string; href: string }[];
  const propertyTypes = t.raw('propertyTypes') as { label: string; href: string }[];
  const accountLinks  = t.raw('accountLinks')  as { label: string; href: string }[];
  const infoLinks     = t.raw('infoLinks')     as { label: string; href: string }[];

  const regionsLinks = REGIONS_SN.map((r) => ({
    label: r,
    href: `/regions/${encodeURIComponent(r)}`,
  }));

  return (
    <main className="py-12 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-5xl">

        {/* Fil d'ariane */}
        <nav aria-label="Fil d'ariane" className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/" className="hover:text-gold-dark transition-colors">
            {t('breadcrumbHome')}
          </Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('breadcrumbSitemap')}</span>
        </nav>

        {/* Bouton retour */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-sub hover:border-gold/50 hover:text-gold-dark transition-all"
        >
          <i className="fa-solid fa-arrow-left text-[10px]" />
          {t('back')}
        </Link>

        {/* En-tête */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold-pale px-3 py-1 text-xs font-semibold text-gold-dark">
            <i className="fa-solid fa-sitemap" /> {t('badge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-sm text-sub">
            {t('subtitle')}
          </p>
        </div>

        {/* Grille principale */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SitemapSection title={t('sectionMain')}    icon="fa-solid fa-house"       links={mainLinks}     />
          <SitemapSection title={t('sectionTypes')}   icon="fa-solid fa-building"    links={propertyTypes} />
          <SitemapSection title={t('sectionAccount')} icon="fa-solid fa-user-circle" links={accountLinks}  />
          <SitemapSection title={t('sectionCities')}  icon="fa-solid fa-city"        links={[
            { label: 'Dakar',       href: '/listings?city=Dakar'       },
            { label: 'Mbour',       href: '/listings?city=Mbour'       },
            { label: 'Saly',        href: '/listings?city=Saly'        },
            { label: 'Rufisque',    href: '/listings?city=Rufisque'    },
            { label: 'Thiès',       href: '/listings?city=Thiès'       },
            { label: 'Touba',       href: '/listings?city=Touba'       },
            { label: 'Ziguinchor',  href: '/listings?city=Ziguinchor'  },
            { label: 'Saint-Louis', href: '/listings?city=Saint-Louis' },
          ]} />
          <SitemapSection title={t('sectionLegal')}   icon="fa-solid fa-circle-info" links={infoLinks}     />
        </div>

        {/* Régions du Sénégal — section large */}
        <div className="mt-5 rounded-2xl border border-line bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gold-dark">
            <i className="fa-solid fa-map-location-dot text-xs" />
            {t('sectionRegions')}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {regionsLinks.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="flex items-center gap-1.5 text-sm text-sub transition-colors hover:text-gold-dark group"
              >
                <i className="fa-solid fa-chevron-right text-[9px] text-gold-dark/40 group-hover:text-gold-dark transition-colors" />
                {r.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
