/**
 * Tarifs publics (lot « page /tarifs ») — lus depuis PlatformConfigService
 * via GET /tarifs (Backend, public, lecture seule), jamais écrits en dur ici
 * : seule source de vérité pour les montants, comme /bailleur/abonnement.
 */
export interface PublicPricing {
  starterPriceFcfa: number;
  proPriceFcfaMonthly: number;
  nightlyCommissionRate: number;
  monthlyCommissionMonths: number;
  auditBasicPriceFcfa: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** `null` = endpoint indisponible (réseau, 5xx…) — le repli visuel est géré
 * par TarifsContent, jamais ici. */
export async function fetchPublicPricing(): Promise<PublicPricing | null> {
  try {
    const res = await fetch(`${API_URL}/tarifs`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicPricing;
  } catch {
    return null;
  }
}
