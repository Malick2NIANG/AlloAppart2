import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/* Ordre d'affichage + icônes — le texte vit dans les fichiers de locale */
const SECTION_ORDER = [
  { key: 'objet',          icon: 'fa-solid fa-file-contract'       },
  { key: 'definitions',    icon: 'fa-solid fa-book'                },
  { key: 'inscription',    icon: 'fa-solid fa-user-plus'           },
  { key: 'bailleurs',      icon: 'fa-solid fa-house'                },
  { key: 'locataires',     icon: 'fa-solid fa-key'                  },
  { key: 'allverifie',     icon: 'fa-solid fa-shield-halved'       },
  { key: 'tarifs',         icon: 'fa-solid fa-sack-dollar'          },
  { key: 'annulation',     icon: 'fa-solid fa-calendar-xmark'       },
  { key: 'litiges',        icon: 'fa-solid fa-scale-balanced'       },
  { key: 'propriete',      icon: 'fa-solid fa-copyright'            },
  { key: 'responsabilite', icon: 'fa-solid fa-circle-exclamation'  },
  { key: 'messagerie',     icon: 'fa-solid fa-comments'             },
  { key: 'suspension',     icon: 'fa-solid fa-ban'                  },
  { key: 'droit',          icon: 'fa-solid fa-gavel'                 },
  { key: 'contact',        icon: 'fa-solid fa-envelope-open-text'  },
] as const;

interface Section { title: string; body: string }

export default async function CGUPage() {
  const t = await getTranslations('cgu');
  const sections = t.raw('sections') as Record<string, Section>;

  return (
    <main className="py-12 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-4xl">

        {/* Fil d'ariane */}
        <nav aria-label={t('breadcrumbCurrent')} className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/" className="hover:text-gold-dark transition-colors">
            {t('breadcrumbHome')}
          </Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('breadcrumbCurrent')}</span>
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
            <i className="fa-solid fa-shield-halved" /> {t('badge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-sub">{t('subtitle')}</p>
          <p className="mt-1 text-xs text-sub/70">
            {t('lastUpdated')} {t('lastUpdatedDate')}
          </p>
        </div>

        {/* Sections */}
        {SECTION_ORDER.map(({ key, icon }) => {
          const s = sections[key];
          if (!s) return null;
          return (
            <div key={key}>
              <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
                <i className={`${icon} text-xs`} />
                {s.title}
              </h2>
              <div className="text-sm leading-relaxed text-sub whitespace-pre-line">
                {s.body}
              </div>
            </div>
          );
        })}

        {/* Note de bas */}
        <div className="mt-12 rounded-2xl border border-gold/30 bg-gold-pale p-5 text-xs leading-relaxed text-sub">
          <p className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 text-gold-dark shrink-0" />
            {t('footnote')}
          </p>
        </div>

        {/* Clause de prévalence linguistique */}
        <p className="mt-4 text-[11px] leading-relaxed text-sub/70 italic">
          {t('prevalence')}
        </p>

      </div>
    </main>
  );
}
