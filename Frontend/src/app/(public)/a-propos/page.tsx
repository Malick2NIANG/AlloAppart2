import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const TEAM = [
  { name: 'Moussa Diallo',    role: 'Fondateur & CEO',                avatar: 'MD' },
  { name: 'Aïda Ndiaye',     role: 'Directrice des Opérations',      avatar: 'AN' },
  { name: 'Ibrahima Fall',   role: "Responsable AlloVérifié™",       avatar: 'IF' },
  { name: 'Fatou Sow',       role: 'Développeuse Full-Stack',         avatar: 'FS' },
];

const VALUES = [
  { icon: 'fa-solid fa-eye',           label: 'Transparence', desc: "Chaque annonce est vérifiée et affichée telle qu'elle est, sans artifice." },
  { icon: 'fa-solid fa-handshake',     label: 'Confiance',    desc: 'Bailleurs et locataires peuvent échanger en toute sécurité sur notre plateforme.' },
  { icon: 'fa-solid fa-lightbulb',     label: 'Innovation',   desc: 'Nous intégrons les meilleures technologies pour simplifier la recherche immobilière.' },
  { icon: 'fa-solid fa-people-group',  label: 'Proximité',    desc: 'Notre équipe terrain est au plus près des réalités locales du marché sénégalais.' },
];

export default async function AboutPage() {
  const locale = await getLocale();

  const breadcrumb = locale === 'en'
    ? [{ label: 'Home', href: '/' }, { label: 'About Us', href: '/a-propos' }]
    : [{ label: 'Accueil', href: '/' }, { label: 'À propos', href: '/a-propos' }];

  const title       = locale === 'en' ? 'About AlloAppart'       : "À propos d'AlloAppart";
  const missionHead = locale === 'en' ? 'Our Mission'            : 'Notre Mission';
  const alloVerHead = locale === 'en' ? 'AlloVérifié™'           : 'AlloVérifié™';
  const legalHead   = locale === 'en' ? 'Legal Information'      : 'Informations légales';
  const valuesHead  = locale === 'en' ? 'Our Values'             : 'Nos valeurs';
  const teamHead    = locale === 'en' ? 'The Team'               : "L'équipe";
  const joinHead    = locale === 'en' ? 'Join Us'                : 'Nous rejoindre';

  return (
    <main className="py-12 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-4xl">

        {/* Fil d'ariane */}
        <nav aria-label="Fil d'ariane" className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />}
              {i < breadcrumb.length - 1
                ? <Link href={crumb.href} className="hover:text-gold-dark transition-colors">{crumb.label}</Link>
                : <span className="text-gold-dark font-medium">{crumb.label}</span>
              }
            </span>
          ))}
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
            <i className="fa-solid fa-building-columns" /> {locale === 'en' ? 'About us' : 'Qui sommes-nous'}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-sub max-w-2xl">
            {locale === 'en'
              ? 'AlloAppart is the leading real-estate marketplace in Senegal — connecting tenants and landlords with verified listings and a dedicated field team.'
              : 'AlloAppart est la marketplace immobilière de référence au Sénégal — mettant en relation locataires et bailleurs grâce à des annonces vérifiées et une équipe terrain dédiée.'}
          </p>
        </div>

        {/* Mission */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {missionHead}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {locale === 'en'
            ? 'Our mission is to make renting in Senegal simple, transparent, and trustworthy. By combining technology and field expertise, AlloAppart removes the friction of traditional real-estate search — giving every Senegalese the ability to find a home that fits their needs and budget.'
            : 'Notre mission est de faciliter la location immobilière au Sénégal en toute confiance. En combinant technologie et expertise terrain, AlloAppart supprime les frictions de la recherche immobilière traditionnelle — permettant à chaque Sénégalais de trouver un logement adapté à ses besoins et à son budget.'}
        </p>

        {/* AlloVérifié™ */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {alloVerHead}
        </h2>
        <div className="rounded-2xl border border-gold/30 bg-gold-pale p-5 text-sm leading-relaxed text-sub">
          <p className="flex items-start gap-2">
            <i className="fa-solid fa-shield-halved mt-0.5 text-gold-dark shrink-0" />
            {locale === 'en'
              ? "AlloVérifié™ is our unique quality seal. Each property listed on AlloAppart is physically visited and assessed by a certified field agent before publication. Photos, surface area, amenities, and pricing are all cross-checked to guarantee accuracy and protect both landlords and tenants."
              : "AlloVérifié™ est notre label qualité unique. Chaque bien publié sur AlloAppart est visité et évalué sur place par un agent terrain certifié avant publication. Photos, superficie, équipements et tarifs sont tous vérifiés pour garantir l'exactitude et protéger bailleurs comme locataires."}
          </p>
        </div>

        {/* Informations légales */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {legalHead}
        </h2>
        <div className="rounded-2xl border border-line bg-card p-5">
          <ul className="space-y-2 text-sm text-sub">
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-building mt-0.5 text-gold-dark shrink-0" />
              <span><strong className="text-text">Dénomination :</strong> AlloAppart SN SARL</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-coins mt-0.5 text-gold-dark shrink-0" />
              <span><strong className="text-text">Capital social :</strong> 10 000 000 FCFA</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-file-contract mt-0.5 text-gold-dark shrink-0" />
              <span><strong className="text-text">RCCM :</strong> SN-DKR-2024-B-12345</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-id-card mt-0.5 text-gold-dark shrink-0" />
              <span><strong className="text-text">NINEA :</strong> 007890123 4Z3</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-location-dot mt-0.5 text-gold-dark shrink-0" />
              <span><strong className="text-text">Siège social :</strong> 25 Rue Carnot, Plateau, Dakar 11000, Sénégal</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-map-pin mt-0.5 text-gold-dark shrink-0" />
              <span><strong className="text-text">Fondée à :</strong> Dakar, Sénégal — 2024</span>
            </li>
          </ul>
        </div>

        {/* Nos valeurs */}
        <h2 className="mt-10 mb-5 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {valuesHead}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.label} className="rounded-2xl border border-line bg-card p-5 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold-pale text-gold-dark">
                <i className={`${v.icon} text-sm`} />
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
          {teamHead}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.name} className="rounded-2xl border border-line bg-card p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/40 bg-gold-pale text-lg font-bold text-gold-dark">
                {m.avatar}
              </div>
              <p className="text-sm font-semibold text-text">{m.name}</p>
              <p className="mt-1 text-xs text-sub">{m.role}</p>
            </div>
          ))}
        </div>

        {/* Nous rejoindre */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          {joinHead}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {locale === 'en'
            ? 'Passionate about real estate and technology in Senegal? Join the AlloAppart adventure and help transform the housing market.'
            : "Passionné·e par l'immobilier et la technologie au Sénégal ? Rejoignez l'aventure AlloAppart et participez à la transformation du marché du logement."}
        </p>
        <div className="mt-5">
          <Link href="/sign-up" className="btn-gold inline-flex items-center gap-2">
            <i className="fa-solid fa-user-plus" />
            {locale === 'en' ? 'Join the platform' : 'Rejoindre la plateforme'}
          </Link>
        </div>

      </div>
    </main>
  );
}
