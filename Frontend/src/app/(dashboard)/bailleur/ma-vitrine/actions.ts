'use server';

import { revalidatePath } from 'next/cache';

/**
 * Invalide le cache ISR du catalogue des agences et de la vitrine publique
 * de l'agence après une mise à jour depuis "Ma vitrine" (logo, nom, bio,
 * adresse, couleur…) — sans ça les visiteurs voient l'ancienne version
 * jusqu'à la prochaine revalidation programmée (jusqu'à 60s pour la vitrine,
 * jusqu'à 1h pour le catalogue /agences, cf. `next: { revalidate }` dans ces
 * deux pages). Même pattern que revalidateListingsCache() (bailleur/listings).
 */
export async function revalidateVitrineCache(slug: string) {
  revalidatePath('/agences');
  if (slug) revalidatePath(`/agences/${slug}`);
}
