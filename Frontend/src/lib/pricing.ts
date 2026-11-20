/**
 * Tarifs publics (lot « page /tarifs », étendu au lot « prix en dur ») —
 * lus depuis PlatformConfigService via GET /tarifs (Backend, public,
 * lecture seule), jamais écrits en dur : seule source de vérité pour les
 * montants, partagée par /tarifs, /bailleur/abonnement, /bailleur/boost,
 * /bailleur/listings et /publier.
 */
export interface PublicPricing {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
  boostPriceFcfa: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** `null` = endpoint indisponible (réseau, 5xx…) — le repli visuel est géré
 * par chaque composant appelant, jamais ici. */
export async function fetchPublicPricing(): Promise<PublicPricing | null> {
  try {
    const res = await fetch(`${API_URL}/tarifs`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicPricing;
  } catch {
    return null;
  }
}

/** Même formatage numérique partout où un montant FCFA de la config est
 * affiché — pas d'unité ("FCFA"/"XOF /mois") ajoutée ici, laissée au texte
 * i18n qui l'entoure. */
export function formatFcfa(amount: number, locale: string): string {
  const numLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  return amount.toLocaleString(numLocale);
}
