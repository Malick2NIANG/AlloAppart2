import Link from 'next/link';
import { getLocale } from 'next-intl/server';

const SECTIONS = [
  {
    key: 'responsable',
    icon: 'fa-solid fa-user-tie',
    title: '1. Responsable du traitement',
    body: `AlloAppart SN SARL, société à responsabilité limitée au capital de 10 000 000 FCFA, immatriculée au Registre du Commerce et du Crédit Mobilier sous le numéro RCCM SN-DKR-2024-B-12345, dont le siège est situé au 25 Rue Carnot, Plateau, Dakar 11000, Sénégal, est responsable du traitement de vos données personnelles dans le cadre de l'utilisation de la plateforme AlloAppart.`,
  },
  {
    key: 'donnees',
    icon: 'fa-solid fa-database',
    title: '2. Données collectées',
    body: `Nous collectons les catégories de données suivantes :\n• Données d'identité : nom, prénom, date de naissance.\n• Données de contact : adresse e-mail, numéro de téléphone.\n• Données de navigation : adresse IP, cookies, pages visitées, durée de session.\n• Données de paiement : informations nécessaires à la transaction (traitées par nos partenaires de paiement agrées).\n• Données relatives aux annonces : photos, descriptions, localisation des biens publiés par les bailleurs.`,
  },
  {
    key: 'finalites',
    icon: 'fa-solid fa-bullseye',
    title: '3. Finalités du traitement',
    body: `Vos données sont traitées aux fins suivantes :\n• Mise en relation entre bailleurs et locataires via la plateforme.\n• Amélioration de nos services et de l'expérience utilisateur.\n• Communication relative à votre compte, vos annonces ou vos recherches.\n• Respect de nos obligations légales et réglementaires.`,
  },
  {
    key: 'base-legale',
    icon: 'fa-solid fa-scale-balanced',
    title: '4. Base légale du traitement',
    body: `Conformément à la Loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données personnelles, nos traitements reposent sur :\n• Votre consentement exprès lors de l'inscription.\n• L'exécution du contrat de services liant AlloAppart à l'utilisateur.\n• Notre intérêt légitime à améliorer et sécuriser nos services.`,
  },
  {
    key: 'conservation',
    icon: 'fa-solid fa-clock',
    title: '5. Durée de conservation',
    body: `• Données de compte : conservées pendant toute la durée de vie du compte, puis 3 ans après sa suppression à des fins d'archivage légal.\n• Logs de connexion et de navigation : 12 mois glissants.\n• Données de paiement : durées imposées par la réglementation financière applicable.`,
  },
  {
    key: 'destinataires',
    icon: 'fa-solid fa-share-nodes',
    title: '6. Destinataires des données',
    body: `Vos données peuvent être partagées avec :\n• Les agents AlloVérifié™ chargés de la vérification terrain des biens.\n• Nos partenaires de paiement agréés (Orange Money, Wave, etc.).\n• Notre hébergeur et prestataires techniques soumis à des obligations de confidentialité strictes.\nNous ne vendons jamais vos données à des tiers à des fins commerciales.`,
  },
  {
    key: 'droits',
    icon: 'fa-solid fa-user-shield',
    title: '7. Droits des utilisateurs',
    body: `Conformément à la loi n° 2008-12, vous disposez des droits suivants :\n• Droit d'accès à vos données personnelles.\n• Droit de rectification des données inexactes.\n• Droit à l'effacement (droit à l'oubli).\n• Droit à la portabilité de vos données.\n• Droit d'opposition au traitement.\n\nPour exercer ces droits, contactez-nous à alloappart221@gmail.com ou par courrier à notre siège social.`,
  },
  {
    key: 'transferts',
    icon: 'fa-solid fa-globe',
    title: '8. Transferts hors Sénégal',
    body: `Tout transfert de données personnelles vers un pays tiers est effectué conformément aux décisions de la Commission de Protection des Données Personnelles (CDP) du Sénégal, notamment en exigeant des garanties appropriées (clauses contractuelles types, pays reconnus comme offrant un niveau de protection adéquat).`,
  },
  {
    key: 'securite',
    icon: 'fa-solid fa-lock',
    title: '9. Sécurité',
    body: `AlloAppart met en œuvre les mesures techniques et organisationnelles suivantes pour protéger vos données :\n• Chiffrement des communications via le protocole TLS (HTTPS).\n• Hachage des mots de passe avec un algorithme cryptographique robuste (bcrypt).\n• Audits de sécurité réguliers et tests de pénétration.\n• Contrôle strict des accès internes selon le principe du moindre privilège.`,
  },
  {
    key: 'contact-dpo',
    icon: 'fa-solid fa-envelope-open-text',
    title: '10. Contact du Délégué à la Protection des Données (DPO)',
    body: `Pour toute question relative à vos données personnelles :\n• E-mail : alloappart221@gmail.com\n• Courrier : AlloAppart SN SARL — DPO, 25 Rue Carnot, Plateau, Dakar 11000, Sénégal`,
  },
  {
    key: 'cdp',
    icon: 'fa-solid fa-building-columns',
    title: '11. Réclamation auprès de la CDP',
    body: `Si vous estimez que vos droits ne sont pas respectés, vous avez le droit d'introduire une réclamation auprès de la Commission de Protection des Données Personnelles (CDP), autorité de contrôle compétente au Sénégal.\n\nCommission de Protection des Données Personnelles (CDP)\nDakar, Sénégal — www.cdp.sn`,
  },
];

export default async function ConfidentialitePage() {
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
            {locale === 'en' ? 'Privacy Policy' : 'Politique de confidentialité'}
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
            {locale === 'en' ? 'Privacy Policy' : 'Politique de confidentialité'}
          </h1>
          <p className="mt-2 text-sm text-sub">
            {locale === 'en'
              ? 'In accordance with Senegalese Law No. 2008-12 of 25 January 2008 on the protection of personal data.'
              : 'Conformément à la Loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données personnelles.'}
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
              ? 'This privacy policy may be updated. We will notify you of any significant changes via email or a prominent notice on the platform.'
              : "Cette politique de confidentialité est susceptible d'être mise à jour. Nous vous informerons de toute modification significative par e-mail ou par un avis bien visible sur la plateforme."}
          </p>
        </div>

      </div>
    </main>
  );
}
