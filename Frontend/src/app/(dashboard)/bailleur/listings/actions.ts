'use server';

import { revalidatePath } from 'next/cache';

/**
 * Invalide le cache ISR de la homepage et de la page listings publique
 * après une mutation d'annonce (publication, archivage, etc.).
 *
 * Server Action : s'exécute côté serveur, aucun secret n'a besoin d'être
 * exposé au client (contrairement à l'ancien appel fetch('/api/revalidate')
 * qui envoyait NEXT_PUBLIC_REVALIDATE_SECRET, visible dans le bundle JS).
 */
export async function revalidateListingsCache() {
  revalidatePath('/');
  revalidatePath('/listings');
}
