import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const COOKIE_TYPES = [
  {
    key: 'necessaires',
    icon: 'fa-solid fa-lock',
    badge: 'Toujours actifs',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    title: '2. Cookies strictement nécessaires',
    body: `Ces cookies sont indispensables au fonctionnement de la plateforme et ne peuvent pas être désactivés. Ils comprennent notamment :\n• Cookies de session utilisateur (maintien de la connexion).\n• Cookies d'authentification (sécurisation de votre espace personnel).\n• Jetons de sécurité CSRF (protection contre les attaques inter-sites).\n\nAucun consentement n'est requis pour ces cookies.`,
  },
  {
    key: 'performance',
    icon: 'fa-solid fa-chart-line',
    badge: 'Consentement requis',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    title: '3. Cookies de performance',
    body: `Ces cookies collectent des données anonymes sur la façon dont les visiteurs utilisent notre plateforme (pages les plus visitées, temps passé, erreurs rencontrées). Ces informations nous permettent d'améliorer notre service.\n\nLes données collectées sont strictement anonymisées et ne permettent pas de vous identifier personnellement. Votre consentement est requis.`,
  },
  {
    key: 'preferences',
    icon: 'fa-solid fa-sliders',
    badge: 'Consentement requis',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    title: '4. Cookies de préférences',
    body: `Ces cookies mémorisent vos préférences afin de personnaliser votre expérience :\n• Langue d'interface sélectionnée (français, anglais, wolof).\n• Préférence de thème (clair / sombre).\n• Filtres de recherche sauvegardés.\n\nVotre consentement est requis pour l'activation de ces cookies.`,
  },
  {
    key: 'tiers',
    icon: 'fa-solid fa-map-location-dot',
    badge: 'Tiers',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    title: '5. Cookies tiers',
    body: `Nous utilisons Google Maps pour afficher la carte interactive des annonces immobilières. Ce service tiers peut déposer ses propres cookies sur votre appareil, soumis à la politique de confidentialité de Google (policies.google.com).\n\nNous vous encourageons à consulter la politique de Google pour comprendre comment ces données sont utilisées.`,
  },
];

export default async function CookiesPage() {
  const locale = await getLocale();

  return (
    <main className="py-12 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-4xl">

        {/* Fil d'ariane */}
        <nav aria-label="Fil d'ariane" className="mb-6 flex items-center gap-1.5 text-xs text-sub">
          <Link href="/" className="hover:text-gold-dark transition-colors">
            {locale === 'en' ? 'Home' : 'Accueil'}
          </Link>
          <i className="fa-solid fa-chevron-right text-[10px] opacity-50" />
          <span className="text-gold-dark font-medium">
            {locale === 'en' ? 'Cookie Policy' : 'Politique des cookies'}
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
            <i className="fa-solid fa-scale-balanced" /> Document officiel
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text md:text-4xl">
            {locale === 'en' ? 'Cookie Policy' : 'Politique des cookies'}
          </h1>
          <p className="mt-2 text-sm text-sub">
            {locale === 'en'
              ? 'How AlloAppart uses cookies and similar technologies to improve your experience.'
              : 'Comment AlloAppart utilise les cookies et technologies similaires pour améliorer votre expérience.'}
          </p>
        </div>

        {/* 1. Qu'est-ce qu'un cookie ? */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          1. {locale === 'en' ? 'What is a cookie?' : "Qu'est-ce qu'un cookie ?"}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {locale === 'en'
            ? 'A cookie is a small text file placed on your device (computer, smartphone, tablet) when you visit a website. Cookies allow the site to remember your actions and preferences over a period of time, so you do not have to keep re-entering them whenever you come back to the site or browse from one page to another.'
            : "Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur, smartphone, tablette) lors de votre visite sur un site web. Les cookies permettent au site de mémoriser vos actions et préférences sur une période donnée, afin que vous n'ayez pas à les saisir à nouveau à chaque nouvelle visite ou navigation de page en page."}
        </p>

        {/* Types de cookies */}
        {COOKIE_TYPES.map((c) => (
          <div key={c.key}>
            <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
              <i className="fa-solid fa-circle-dot text-xs" />
              {c.title}
            </h2>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${c.badgeColor}`}>
                <i className={`${c.icon} text-[10px]`} />
                {c.badge}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-sub whitespace-pre-line">{c.body}</p>
          </div>
        ))}

        {/* Durée de conservation */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          6. {locale === 'en' ? 'Retention period' : 'Durée de conservation'}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm text-sub">
            <thead>
              <tr className="border-b border-line bg-card">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text">
                  {locale === 'en' ? 'Type' : 'Type'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text">
                  {locale === 'en' ? 'Duration' : 'Durée'}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/50">
                <td className="px-4 py-3">{locale === 'en' ? 'Session cookies' : 'Cookies de session'}</td>
                <td className="px-4 py-3">{locale === 'en' ? 'Deleted when browser is closed' : 'Supprimés à la fermeture du navigateur'}</td>
              </tr>
              <tr className="border-b border-line/50">
                <td className="px-4 py-3">{locale === 'en' ? 'Preference cookies' : 'Cookies de préférences'}</td>
                <td className="px-4 py-3">{locale === 'en' ? '13 months maximum' : '13 mois maximum'}</td>
              </tr>
              <tr className="border-b border-line/50">
                <td className="px-4 py-3">{locale === 'en' ? 'Performance cookies' : 'Cookies de performance'}</td>
                <td className="px-4 py-3">{locale === 'en' ? '13 months maximum' : '13 mois maximum'}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">{locale === 'en' ? 'Third-party cookies' : 'Cookies tiers'}</td>
                <td className="px-4 py-3">{locale === 'en' ? 'According to third-party policy' : 'Selon la politique du tiers'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gérer vos cookies */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          7. {locale === 'en' ? 'How to manage your cookies' : 'Comment gérer vos cookies'}
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {locale === 'en'
            ? 'You can manage your cookie preferences at any time:\n\n• Via your browser settings: each browser offers options to block, delete or restrict cookies. Refer to your browser\'s help section for detailed instructions.\n• Via the consent management button: use the "Cookie settings" button at the bottom of each page to withdraw or adjust your consent at any time.\n\nNote: disabling certain cookies may affect the functionality of the platform.'
            : "Vous pouvez gérer vos préférences en matière de cookies à tout moment :\n\n• Via les paramètres de votre navigateur : chaque navigateur propose des options pour bloquer, supprimer ou restreindre les cookies. Consultez l'aide de votre navigateur pour des instructions détaillées.\n• Via le bouton de gestion du consentement : utilisez le bouton « Paramètres des cookies » en bas de chaque page pour retirer ou ajuster votre consentement à tout moment.\n\nNote : la désactivation de certains cookies peut affecter le bon fonctionnement de la plateforme."}
        </p>

        {/* Contact */}
        <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
          <i className="fa-solid fa-circle-dot text-xs" />
          8. Contact
        </h2>
        <p className="text-sm leading-relaxed text-sub">
          {locale === 'en'
            ? 'For any question about our cookie policy, please contact us at:'
            : 'Pour toute question relative à notre politique des cookies, contactez-nous à :'}
          {' '}
          <a href="mailto:alloappart221@gmail.com" className="text-gold-dark hover:underline">
            alloappart221@gmail.com
          </a>
        </p>

        {/* Note de bas */}
        <div className="mt-12 rounded-2xl border border-gold/30 bg-gold-pale p-5 text-xs leading-relaxed text-sub">
          <p className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 text-gold-dark shrink-0" />
            {locale === 'en'
              ? 'This policy is complementary to our Privacy Policy and our Terms of Service.'
              : 'Cette politique est complémentaire à notre Politique de confidentialité et à nos CGU.'}
            {' '}
            <Link href="/confidentialite" className="text-gold-dark hover:underline">
              {locale === 'en' ? 'Privacy Policy' : 'Politique de confidentialité'}
            </Link>
            {' · '}
            <Link href="/cgu" className="text-gold-dark hover:underline">
              CGU
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
}
