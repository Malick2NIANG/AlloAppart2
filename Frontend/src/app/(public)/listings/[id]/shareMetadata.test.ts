import { describe, it, expect } from 'vitest';
import { buildShareDescription, buildListingMetadata } from './shareMetadata';
import type { Listing } from '@/types/listing';

const BASE: Listing = {
  id: 'l1',
  title: 'Bel appartement',
  description: 'Un bel appartement.',
  price: 150000,
  pricePerNight: null,
  rentalMode: 'MONTHLY',
  transactionType: 'LOCATION',
  type: 'APPARTEMENT',
  status: 'ACTIVE',
  isVerified: false,
  lat: 14.7,
  lng: -17.4,
  city: 'Mermoz',
  region: 'Dakar',
  rooms: 3,
  beds: 2,
  baths: 1,
  surface: 80,
  boostScore: 0,
  images: ['https://res.cloudinary.com/demo/image/upload/v1/listing.jpg'],
  amenities: [],
  ownerId: 'owner1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as Listing;

describe('buildShareDescription — lot « raccourci » (partage)', () => {
  it('annonce VENTE : prix de vente, jamais /mois ni /nuit', () => {
    const listing: Listing = { ...BASE, transactionType: 'VENTE', price: 45000000, type: 'VILLA', city: 'Saly' };
    const description = buildShareDescription(listing);
    expect(description).toContain('45 000 000 FCFA');
    expect(description).not.toMatch(/\/mois|\/nuit/);
    expect(description).toContain('Saly');
  });

  it('annonce NUITÉE : prix par nuit, unité "/nuit", jamais le loyer mensuel dérivé', () => {
    const listing: Listing = {
      ...BASE,
      rentalMode: 'NIGHTLY',
      pricePerNight: 25000,
      price: 750000, // équivalent mensuel dérivé — ne doit jamais apparaître ici
      type: 'STUDIO',
      city: 'Almadies',
    };
    const description = buildShareDescription(listing);
    expect(description).toContain('25 000 FCFA/nuit');
    expect(description).not.toContain('750 000');
    expect(description).toContain('Almadies');
  });

  it('annonce mensuelle classique : prix par mois', () => {
    const description = buildShareDescription(BASE);
    expect(description).toContain('150 000 FCFA/mois');
  });

  it('aucune donnée privée (téléphone, adresse exacte) dans la description', () => {
    const description = buildShareDescription(BASE);
    expect(description).not.toMatch(/\+?\d{7,}/); // pas de numéro de téléphone
  });
});

describe('buildListingMetadata — lot « raccourci » (partage)', () => {
  it('annonce active : titre, description structurée, image HTTPS absolue', () => {
    const metadata = buildListingMetadata(BASE);
    expect(metadata).not.toBeNull();
    expect(metadata?.title).toContain(BASE.title);
    expect(metadata?.openGraph?.images).toHaveLength(1);
    expect(metadata?.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it.each(['DRAFT', 'SUSPENDED', 'RENTED'] as const)('annonce %s : aucun aperçu (null)', (status) => {
    const listing: Listing = { ...BASE, status };
    expect(buildListingMetadata(listing)).toBeNull();
  });

  it('image non HTTPS : exclue de l\'aperçu (jamais une URL http:// ou relative)', () => {
    const listing: Listing = { ...BASE, images: ['http://example.com/photo.jpg'] };
    const metadata = buildListingMetadata(listing);
    expect(metadata?.openGraph?.images).toEqual([]);
  });
});
