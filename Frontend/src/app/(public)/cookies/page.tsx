import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/* Ordre d'affichage + style — le texte vit dans les fichiers de locale */
const COOKIE_ORDER = [
  { key: 'necessaires', icon: 'fa-solid fa-lock',              badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'performance', icon: 'fa-solid fa-chart-line',        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'           },
  { key: 'preferences', icon: 'fa-solid fa-sliders',           badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'           },
  { key: 'tiers',       icon: 'fa-solid fa-map-location-dot',  badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'        },
] as const;

interface CookieType { badge: string; title: string; body: string }

export default async function CookiesPage() {
  const t = await getTranslations('cookies');
  const types = t.raw('types') as Record<string, CookieType>;

  const RETENTION_ROWS = [
    { key: 'session', label: t('rowSession'), duration: t('rowSessionDur') },
    { key: 'pref',    label: t('rowPref'),    duration: t('rowPrefDur')    },
    { key: 'perf',    label: t('rowPerf'),    duration: t('rowPerfDur')    },
    { key: 'third',   label: t('rowThird'),   duration: t('rowThirdDur')   },
  ];

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
            <i className="fa-solid fa-cookie-bite" /> {t('badge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-sub">{t('subtitle')}</p>
          <p className="mt-1 text-xs text-sub/70">
            {t('lastUpdated')} {t('lastUpdatedDate')}
          </p>
        </div>

        {/* 1. Qu'est-ce qu'un cookie ? */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-question text-xs" />
          {t('whatTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-sub">{t('whatBody')}</p>

        {/* Types de cookies */}
        {COOKIE_ORDER.map(({ key, icon, badgeColor }) => {
          const c = types[key];
          if (!c) return null;
          return (
            <div key={key}>
              <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
                <i className={`${icon} text-xs`} />
                {c.title}
              </h2>
              <div className="mb-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor}`}>
                  <i className={`${icon} text-[10px]`} />
                  {c.badge}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-sub whitespace-pre-line">{c.body}</p>
            </div>
          );
        })}

        {/* Durée de conservation */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-clock text-xs" />
          {t('retentionTitle')}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm text-sub">
            <thead>
              <tr className="border-b border-line bg-card">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text">{t('thType')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text">{t('thDuration')}</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_ROWS.map((r, i) => (
                <tr key={r.key} className={i < RETENTION_ROWS.length - 1 ? 'border-b border-line/50' : ''}>
                  <td className="px-4 py-3">{r.label}</td>
                  <td className="px-4 py-3">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gérer vos cookies */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-sliders text-xs" />
          {t('manageTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-sub whitespace-pre-line">{t('manageBody')}</p>

        {/* Contact */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-envelope text-xs" />
          {t('contactTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {t('contactBody')}{' '}
          <a href="mailto:alloappart221@gmail.com" className="text-gold-dark hover:underline">
            alloappart221@gmail.com
          </a>
        </p>

        {/* Note de bas */}
        <div className="mt-12 rounded-2xl border border-gold/30 bg-gold-pale p-5 text-xs leading-relaxed text-sub">
          <p className="flex flex-wrap items-start gap-x-1 gap-y-1">
            <i className="fa-solid fa-circle-info mt-0.5 text-gold-dark shrink-0" />
            {t('footnote')}
            <Link href="/confidentialite" className="text-gold-dark hover:underline">
              {t('linkPrivacy')}
            </Link>
            <span>·</span>
            <Link href="/cgu" className="text-gold-dark hover:underline">
              {t('linkTerms')}
            </Link>
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
