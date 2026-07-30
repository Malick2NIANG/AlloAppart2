import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/* Les noms sont des noms propres — seuls les intitulés de poste sont traduits */
const TEAM = [
  { name: 'Moussa Diallo',  roleKey: 'teamRoleCeo',        avatar: 'MD' },
  { name: 'Aïda Ndiaye',    roleKey: 'teamRoleOps',        avatar: 'AN' },
  { name: 'Ibrahima Fall',  roleKey: 'teamRoleVerif',      avatar: 'IF' },
  { name: 'Fatou Sow',      roleKey: 'teamRoleDeveloper',  avatar: 'FS' },
] as const;

const LEGAL_ITEMS = [
  { icon: 'fa-solid fa-building',       labelKey: 'legalDenomination', value: 'AlloAppart SN SARL'               },
  { icon: 'fa-solid fa-coins',          labelKey: 'legalCapital',      value: '10 000 000 FCFA'                  },
  { icon: 'fa-solid fa-file-contract',  labelKey: 'legalRccm',         value: 'SN-DKR-2024-B-12345'              },
  { icon: 'fa-solid fa-id-card',        labelKey: 'legalNinea',        value: '007890123 4Z3'                    },
  { icon: 'fa-solid fa-location-dot',   labelKey: 'legalSiege',        value: '25 Rue Carnot, Plateau, Dakar 11000, Sénégal' },
  { icon: 'fa-solid fa-map-pin',        labelKey: 'legalFounded',      value: 'Dakar, Sénégal — 2024'            },
];

export default async function AboutPage() {
  const t = await getTranslations('apropos');
  const values   = t.raw('values')      as Array<{ label: string; desc: string }>;
  const valIcons = t.raw('valuesIcons') as string[];

  return (
    <main className="py-12 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-4xl">

        {/* Fil d'ariane */}
        <nav aria-label="Fil d'ariane" className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/" className="hover:text-gold-dark transition-colors">{t('breadcrumbHome')}</Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">{t('breadcrumbAbout')}</span>
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
            <i className="fa-solid fa-building-columns" /> {t('badge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-sub max-w-2xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Mission */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {t('missionHead')}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {t('missionText')}
        </p>

        {/* AlloVérifié™ */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {t('alloVerHead')}
        </h2>
        <div className="rounded-2xl border border-gold/30 bg-gold-pale p-5 text-sm leading-relaxed text-sub">
          <p className="flex items-start gap-2">
            <i className="fa-solid fa-shield-halved mt-0.5 text-gold-dark shrink-0" />
            {t('alloVerText')}
          </p>
        </div>

        {/* Informations légales */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {t('legalHead')}
        </h2>
        <div className="rounded-2xl border border-line bg-card p-5">
          <ul className="space-y-2 text-sm text-sub">
            {LEGAL_ITEMS.map((item) => (
              <li key={item.labelKey} className="flex items-start gap-2">
                <i className={`${item.icon} mt-0.5 text-gold-dark shrink-0`} />
                <span>
                  <strong className="text-text">{t(item.labelKey as Parameters<typeof t>[0])} :</strong>{' '}
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Nos valeurs */}
        <h2 className="mt-10 mb-5 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {t('valuesHead')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map((v, i) => (
            <div key={v.label} className="rounded-2xl border border-line bg-card p-5 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold-pale text-gold-dark">
                <i className={`${valIcons[i]} text-sm`} />
              </span>
              <div>
                <p className="text-sm font-semibold text-text">{v.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-sub">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* L'équipe */}
        <h2 className="mt-10 mb-5 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {t('teamHead')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.name} className="rounded-2xl border border-line bg-card p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/40 bg-gold-pale text-lg font-bold text-gold-dark">
                {m.avatar}
              </div>
              <p className="text-sm font-semibold text-text">{m.name}</p>
              <p className="mt-1 text-xs text-sub">{t(m.roleKey)}</p>
            </div>
          ))}
        </div>

        {/* Nous rejoindre */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {t('joinHead')}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {t('joinText')}
        </p>
        <div className="mt-5">
          <Link href="/sign-up" className="btn-gold inline-flex items-center gap-2">
            <i className="fa-solid fa-user-plus" />
            {t('joinCta')}
          </Link>
        </div>

      </div>
    </main>
  );
}
