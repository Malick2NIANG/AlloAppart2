import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const SECTIONS = [
  {
    key: 'objet',
    icon: 'fa-solid fa-file-lines',
    title: "1. Objet et champ d'application",
    body: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme AlloAppart, accessible à l'adresse www.alloappart.sn, exploitée par la société AlloAppart SN SARL.\n\nToute utilisation de la plateforme implique l'acceptation pleine et entière des présentes CGU. Ces CGU sont soumises au droit sénégalais, notamment au Code des Obligations Civiles et Commerciales (COCC) et à la loi n° 2008-11 du 25 janvier 2008 sur la cybercriminalité.`,
  },
  {
    key: 'definitions',
    icon: 'fa-solid fa-book',
    title: '2. Définitions',
    body: `• Plateforme : le site web et les applications mobiles AlloAppart.\n• Utilisateur : toute personne physique ou morale ayant créé un compte sur la Plateforme.\n• Bailleur : utilisateur proposant un bien immobilier à la location.\n• Locataire : utilisateur recherchant un bien immobilier à louer.\n• Annonce : publication décrivant un bien immobilier disponible à la location.\n• AlloVérifié™ : label qualité attribué aux annonces ayant fait l'objet d'une vérification terrain par un agent certifié AlloAppart.`,
  },
  {
    key: 'inscription',
    icon: 'fa-solid fa-user-plus',
    title: '3. Inscription et compte utilisateur',
    body: `L'accès aux fonctionnalités complètes de la Plateforme est réservé aux personnes physiques âgées d'au moins 18 ans et aux personnes morales légalement constituées.\n\nL'utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de son inscription. Toute usurpation d'identité ou fourniture de fausses informations peut entraîner la suspension immédiate du compte et des poursuites judiciaires conformément à la législation sénégalaise en vigueur.`,
  },
  {
    key: 'bailleurs',
    icon: 'fa-solid fa-house-chimney-user',
    title: '4. Obligations des bailleurs',
    body: `Les bailleurs s'engagent à :\n• Publier des annonces conformes à la réalité du bien (photos récentes, superficie exacte, état réel).\n• Garantir la disponibilité effective du bien au moment de la publication.\n• Indiquer des tarifs de location exacts et comprenant toutes les charges applicables.\n• Ne pas publier de biens dont ils ne sont pas propriétaires ou mandataires légitimes.\n• Respecter la réglementation sénégalaise applicable aux baux d'habitation.`,
  },
  {
    key: 'locataires',
    icon: 'fa-solid fa-person-walking-arrow-right',
    title: '5. Obligations des locataires',
    body: `Les locataires s'engagent à :\n• Utiliser la Plateforme de manière loyale et honnête.\n• Respecter les bailleurs et leurs biens lors des visites.\n• Ne pas contacter les bailleurs en dehors de la Plateforme à des fins de contournement des CGU.\n• Ne pas soumettre de demandes de location frauduleuses ou de fausses identités.`,
  },
  {
    key: 'allovérifié',
    icon: 'fa-solid fa-shield-halved',
    title: '6. AlloVérifié™',
    body: `AlloVérifié™ est un engagement de vérification terrain effectué par des agents AlloAppart certifiés. Une annonce portant ce label a été physiquement visitée et les informations clés ont été contrôlées (état du logement, superficie, équipements, conformité des photos).\n\nLimite de garantie : AlloVérifié™ ne constitue pas une garantie juridique du contrat de bail et n'engage pas la responsabilité d'AlloAppart quant aux éventuels litiges survenant après la signature du bail entre bailleur et locataire.`,
  },
  {
    key: 'tarifs',
    icon: 'fa-solid fa-coins',
    title: '7. Tarifs et commissions',
    body: `• Publication d'annonces : gratuite pour les bailleurs particuliers.\n• Commission : 5 % du montant du premier loyer pour toute transaction aboutie facilitée par la Plateforme (mise en relation directe ayant conduit à la signature d'un bail).\n• Les tarifs peuvent être modifiés avec un préavis de 30 jours communiqué par e-mail aux utilisateurs enregistrés.`,
  },
  {
    key: 'propriete-intellectuelle',
    icon: 'fa-solid fa-copyright',
    title: '8. Propriété intellectuelle',
    body: `La marque AlloAppart, le logo, le label AlloVérifié™ ainsi que l'ensemble des contenus de la Plateforme (textes, images, interfaces, code source) sont la propriété exclusive d'AlloAppart SN SARL et sont protégés par le droit sénégalais de la propriété intellectuelle.\n\nToute reproduction, représentation ou exploitation sans autorisation préalable écrite est strictement interdite.`,
  },
  {
    key: 'responsabilite',
    icon: 'fa-solid fa-circle-exclamation',
    title: '9. Responsabilité limitée',
    body: `AlloAppart agit en qualité d'intermédiaire technique et de mise en relation. AlloAppart n'est pas partie au contrat de bail conclu entre bailleur et locataire et ne peut être tenu responsable des litiges survenant dans le cadre de cette relation.\n\nAlloAppart s'engage à assurer la disponibilité de la Plateforme dans des conditions normales, mais ne peut garantir une disponibilité ininterrompue.`,
  },
  {
    key: 'suspension',
    icon: 'fa-solid fa-ban',
    title: '10. Suspension et résiliation de compte',
    body: `AlloAppart se réserve le droit de suspendre ou de résilier un compte utilisateur sans préavis en cas de :\n• Violation des présentes CGU.\n• Fourniture d'informations fausses ou trompeuses.\n• Comportement frauduleux avéré ou tentative d'escroquerie.\n• Décision de justice ou injonction d'une autorité compétente.\n\nL'utilisateur peut supprimer son compte à tout moment depuis les paramètres de son espace personnel.`,
  },
  {
    key: 'droit',
    icon: 'fa-solid fa-gavel',
    title: '11. Droit applicable et juridiction compétente',
    body: `Les présentes CGU sont régies par le droit de la République du Sénégal.\n\nEn cas de litige relatif à l'interprétation ou à l'exécution des présentes CGU, et à défaut de résolution amiable dans un délai de 30 jours, les parties conviennent de soumettre le différend à la juridiction exclusive du Tribunal de Grande Instance de Dakar.`,
  },
  {
    key: 'contact-legal',
    icon: 'fa-solid fa-envelope',
    title: '12. Contact',
    body: `Pour toute question juridique relative aux présentes CGU :\n• E-mail : alloappart221@gmail.com\n• Courrier : AlloAppart SN SARL — Service Juridique, 25 Rue Carnot, Plateau, Dakar 11000, Sénégal`,
  },
];

export default async function CguPage() {
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
            {locale === 'en' ? 'Terms of Service' : "Conditions Générales d'Utilisation"}
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
            {locale === 'en' ? 'Terms of Service' : "Conditions Générales d'Utilisation"}
          </h1>
          <p className="mt-2 text-sm text-sub">
            {locale === 'en'
              ? 'In accordance with the Senegalese Code of Civil and Commercial Obligations (COCC) and Law No. 2008-11 on cybercrime.'
              : 'Conformément au Code des Obligations Civiles et Commerciales (COCC) sénégalais et à la loi n° 2008-11 sur la cybercriminalité.'}
          </p>
          <p className="mt-1 text-xs text-sub/70">
            {locale === 'en' ? 'Last updated:' : 'Dernière mise à jour :'} 18 mai 2026
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <div key={s.key}>
            <h2 className="mt-10 mb-3 text-lg font-semibold text-gold-dark flex items-center gap-2">
              <i className="fa-solid fa-circle-dot text-xs" />
              {s.title}
            </h2>
            <div className="text-sm leading-relaxed text-sub whitespace-pre-line">
              {s.body}
            </div>
          </div>
        ))}

        {/* Note de bas */}
        <div className="mt-12 rounded-2xl border border-gold/30 bg-gold-pale p-5 text-xs leading-relaxed text-sub">
          <p className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 text-gold-dark shrink-0" />
            {locale === 'en'
              ? 'These Terms of Service may be updated. Users will be notified of significant changes by email with a minimum 15-day notice period.'
              : 'Ces CGU peuvent être mises à jour. Les utilisateurs seront informés des modifications significatives par e-mail avec un préavis minimum de 15 jours.'}
          </p>
        </div>

      </div>
    </main>
  );
}
