import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const REGIONS_SN = [
  'Dakar', 'Thiès', 'Diourbel', 'Fatick', 'Kaolack',
  'Kaffrine', 'Ziguinchor', 'Sédhiou', 'Kolda', 'Tambacounda',
  'Kédougou', 'Saint-Louis', 'Louga', 'Matam',
];

const POPULAR_CITIES = [
  { label: 'Dakar',        href: '/listings?city=Dakar'       },
  { label: 'Mbour',        href: '/listings?city=Mbour'       },
  { label: 'Saly',         href: '/listings?city=Saly'        },
  { label: 'Rufisque',     href: '/listings?city=Rufisque'    },
  { label: 'Thiès',        href: '/listings?city=Thiès'       },
  { label: 'Touba',        href: '/listings?city=Touba'       },
  { label: 'Ziguinchor',   href: '/listings?city=Ziguinchor'  },
  { label: 'Saint-Louis',  href: '/listings?city=Saint-Louis' },
];

const PROPERTY_TYPES = [
  { label: 'Appartements',        href: '/listings?type=APPARTEMENT' },
  { label: 'Studios',             href: '/listings?type=STUDIO'      },
  { label: 'Villas',              href: '/listings?type=VILLA'       },
  { label: 'Bureaux',             href: '/listings?type=BUREAU'      },
  { label: 'Chambres',            href: '/listings?type=CHAMBRE'     },
  { label: 'Locaux commerciaux',  href: '/listings?type=LOCAL'       },
  { label: 'Terrains',            href: '/listings?type=TERRAIN'     },
];

const ACCOUNT_LINKS = [
  { label: 'Connexion',    href: '/sign-in'              },
  { label: 'Inscription',  href: '/sign-up'              },
  { label: 'Mon espace',   href: '/locataire/dashboard'  },
];

const INFO_LINKS = [
  { label: 'À propos',               href: '/a-propos'       },
  { label: 'CGU',                    href: '/cgu'            },
  { label: 'Politique de confidentialité', href: '/confidentialite' },
  { label: 'Politique des cookies',  href: '/cookies'        },
  { label: 'Plan du site',           href: '/plan-du-site'   },
];

const MAIN_LINKS = [
  { label: 'Accueil',         href: '/'          },
  { label: 'Toutes les annonces', href: '/listings' },
  { label: 'À propos',        href: '/a-propos'  },
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
  const locale = await getLocale();

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
            {locale === 'en' ? 'Home' : 'Accueil'}
          </Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">
            {locale === 'en' ? 'Site Map' : 'Plan du site'}
          </span>
        </nav>

        {/* Bouton retour */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-sub hover:border-gold/50 hover:text-gold-dark transition-all"
        >
          <i className="fa-solid fa-arrow-left text-[10px]" />
          {locale === 'en' ? 'Back to home' : "Retour à l'accueil"}
        </Link>

        {/* En-tête */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold-pale px-3 py-1 text-xs font-semibold text-gold-dark">
            <i className="fa-solid fa-sitemap" /> {locale === 'en' ? 'Navigation' : 'Navigation'}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {locale === 'en' ? 'Site Map' : 'Plan du site'}
          </h1>
          <p className="mt-3 text-sm text-sub">
            {locale === 'en'
              ? 'Find all the pages and sections available on AlloAppart.'
              : 'Retrouvez toutes les pages et sections disponibles sur AlloAppart.'}
          </p>
        </div>

        {/* Grille principale */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SitemapSection
            title={locale === 'en' ? 'Main' : 'Principal'}
            icon="fa-solid fa-house"
            links={MAIN_LINKS}
          />
          <SitemapSection
            title={locale === 'en' ? 'Property types' : 'Types de biens'}
            icon="fa-solid fa-building"
            links={PROPERTY_TYPES}
          />
          <SitemapSection
            title={locale === 'en' ? 'Account' : 'Compte'}
            icon="fa-solid fa-user-circle"
            links={ACCOUNT_LINKS}
          />
          <SitemapSection
            title={locale === 'en' ? 'Popular cities' : 'Villes populaires'}
            icon="fa-solid fa-city"
            links={POPULAR_CITIES}
          />
          <SitemapSection
            title={locale === 'en' ? 'Legal information' : 'Informations'}
            icon="fa-solid fa-circle-info"
            links={INFO_LINKS}
          />
        </div>

        {/* Régions du Sénégal — section large */}
        <div className="mt-5 rounded-2xl border border-line bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gold-dark">
            <i className="fa-solid fa-map-location-dot text-xs" />
            {locale === 'en' ? '14 Regions of Senegal' : '14 Régions du Sénégal'}
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
