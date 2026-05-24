import { api } from '@/lib/api';
import type { Listing } from '@/types';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let listings: Listing[] = [];
  if (q) {
    try {
      listings = await api.get<Listing[]>(`/search?q=${encodeURIComponent(q)}`);
    } catch {
      listings = [];
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Recherche</h1>
      <form method="GET" className="flex gap-3 mb-8">
        <input
          name="q"
          defaultValue={q}
          placeholder="Ville, quartier, type de logement…"
          className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="submit" className="px-5 py-2 bg-black text-white rounded-lg text-sm hover:bg-zinc-800 transition-colors">
          Chercher
        </button>
      </form>
      {q && listings.length === 0 && (
        <p className="text-zinc-500">Aucun résultat pour « {q} ».</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <Link key={listing.id} href={`/listings/${listing.id}`} className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-video bg-zinc-100" />
            <div className="p-4">
              <p className="font-semibold">{listing.title}</p>
              <p className="text-sm text-zinc-500">{listing.city}</p>
              <p className="mt-2 font-bold">{formatPrice(listing.price)}<span className="text-sm font-normal text-zinc-500">/mois</span></p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
