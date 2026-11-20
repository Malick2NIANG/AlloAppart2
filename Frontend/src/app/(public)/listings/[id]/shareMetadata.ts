import type { Metadata } from 'next';
import { type Listing, priceToNumber, getListingPriceAmounts } from '@/types/listing';

/**
 * Lot « raccourci » (partage) — Open Graph/Twitter d'une fiche annonce.
 * Extrait de page.tsx (Server Component, jamais testé directement dans ce
 * projet) pour rester testable comme une fonction pure, même principe que
 * src/lib/pricing.ts.
 */

// Montant/unité/quartier/type lus de la donnée réelle — jamais le texte
// libre du bailleur seul, qui peut omettre ces faits. Aucune donnée privée
// (téléphone, adresse exacte) ici.
export function buildShareDescription(listing: Listing): string {
  const isVente = listing.transactionType === 'VENTE';
  const priceText = isVente
    ? `${priceToNumber(listing.price).toLocaleString('fr-FR')} FCFA`
    : getListingPriceAmounts(listing)
        .map((e) => `${e.amount.toLocaleString('fr-FR')} FCFA${e.unit === 'sale' ? '' : `/${e.unit === 'night' ? 'nuit' : 'mois'}`}`)
        .join(' · ');
  const typeLabel = listing.type.charAt(0) + listing.type.slice(1).toLowerCase().replace(/_/g, ' ');
  return `${typeLabel} à ${listing.city} · ${priceText}`;
}

export const NO_INDEX_METADATA: Metadata = {
  title: 'Annonce — AlloAppart',
  robots: { index: false, follow: false },
};

/** `null` = annonce non publique (brouillon/suspendue) ou absente — appelant
 * renvoie alors NO_INDEX_METADATA, jamais d'aperçu. */
export function buildListingMetadata(listing: Listing): Metadata | null {
  if (listing.status !== 'ACTIVE') return null;

  const rawImage = listing.images?.[0];
  // Image absolue en HTTPS uniquement (exigence WhatsApp/Twitter) — jamais
  // une URL relative ou http://.
  const image = rawImage && /^https:\/\//.test(rawImage) ? rawImage : undefined;
  const description = buildShareDescription(listing);
  return {
    title: `${listing.title} — AlloAppart`,
    description,
    openGraph: {
      title: listing.title,
      description,
      images: image ? [{ url: image, width: 1200, height: 630, alt: listing.title }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: listing.title,
      description,
      images: image ? [image] : [],
    },
  };
}
