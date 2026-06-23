/**
 * seed.pilot.ts — Données de test pour le Controlled Live Session
 *
 * Crée les comptes pilotes et annonces décrites dans CONTROLLED_LIVE.md.
 * NE PAS exécuter en production réelle — uniquement sur l'environnement staging/test.
 *
 * Usage :
 *   npx ts-node -r tsconfig-paths/register prisma/seed.pilot.ts
 */

import {
  PrismaClient,
  Role,
  ListingType,
  ListingStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const PILOT_USERS = [
  {
    clerkId: 'pilot_bailleur_1',
    email: 'bailleur1@test.sn',
    firstName: 'Oumar',
    lastName: 'Sy',
    phone: '+221771111001',
    roles: [Role.LOCATAIRE, Role.BAILLEUR],
    isVerified: true,
  },
  {
    clerkId: 'pilot_bailleur_2',
    email: 'bailleur2@test.sn',
    firstName: 'Rokhaya',
    lastName: 'Fall',
    phone: '+221771111002',
    roles: [Role.LOCATAIRE, Role.BAILLEUR],
    isVerified: true,
  },
  {
    clerkId: 'pilot_locataire_1',
    email: 'locataire1@test.sn',
    firstName: 'Ibrahima',
    lastName: 'Diop',
    phone: '+221771111003',
    roles: [Role.LOCATAIRE],
    isVerified: false,
  },
  {
    clerkId: 'pilot_locataire_2',
    email: 'locataire2@test.sn',
    firstName: 'Mariama',
    lastName: 'Gaye',
    phone: '+221771111004',
    roles: [Role.LOCATAIRE],
    isVerified: false,
  },
];

const PILOT_LISTINGS = [
  {
    title: 'Appartement F3 - Plateau Dakar',
    description:
      'Bel appartement lumineux de 3 pièces au coeur du Plateau. ' +
      'Cuisine équipée, salon spacieux, 2 chambres, 1 SDB. ' +
      'Proximité administrations et commerces.',
    type: ListingType.APPARTEMENT,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Rue Carnot, Plateau',
    price: 200000,
    bedrooms: 2,
    bathrooms: 1,
    surface: 85,
    lat: 14.6928,
    lng: -17.4467,
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
    ],
    amenities: ['Eau courante', 'Électricité', 'Gardien', 'Parking'],
    status: ListingStatus.ACTIVE,
    ownerKey: 'pilot_bailleur_1',
  },
  {
    title: 'Studio meublé - Almadies',
    description:
      'Studio entièrement meublé dans le quartier résidentiel des Almadies. ' +
      'Climatisation, wifi, cuisine équipée. Idéal pour célibataire ou couple.',
    type: ListingType.STUDIO,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Route des Almadies',
    price: 150000,
    bedrooms: 1,
    bathrooms: 1,
    surface: 35,
    lat: 14.7454,
    lng: -17.5196,
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
    ],
    amenities: ['Meublé', 'Climatisation', 'WiFi', 'Eau chaude'],
    status: ListingStatus.ACTIVE,
    ownerKey: 'pilot_bailleur_1',
  },
  {
    title: 'Appartement F2 - Mermoz',
    description:
      'Appartement 2 pièces calme et sécurisé à Mermoz. ' +
      'Résidence gardée, parking privé, proche toutes commodités.',
    type: ListingType.APPARTEMENT,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Rue 14 x 11, Mermoz',
    price: 180000,
    bedrooms: 1,
    bathrooms: 1,
    surface: 55,
    lat: 14.7224,
    lng: -17.4866,
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
    ],
    amenities: ['Gardien', 'Parking', 'Eau courante', 'Groupe électrogène'],
    status: ListingStatus.ACTIVE,
    ownerKey: 'pilot_bailleur_2',
  },
  {
    title: 'Villa 4 pièces - Sacré-Coeur',
    description:
      'Grande villa avec jardin privé à Sacré-Coeur 3. ' +
      '4 chambres, 2 salles de bains, cuisine américaine. Piscine commune.',
    type: ListingType.VILLA,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Sacré-Coeur 3',
    price: 450000,
    bedrooms: 4,
    bathrooms: 2,
    surface: 180,
    lat: 14.7167,
    lng: -17.4667,
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
    ],
    amenities: ['Piscine', 'Jardin', 'Parking', 'Gardien', 'Groupe électrogène'],
    status: ListingStatus.ACTIVE,
    ownerKey: 'pilot_bailleur_2',
  },
  {
    title: 'Studio - Cité Keur Gorgui',
    description:
      'Studio fonctionnel proche de la Cité Keur Gorgui. ' +
      'Transports en commun à 5 minutes, marché à proximité.',
    type: ListingType.STUDIO,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Cité Keur Gorgui',
    price: 100000,
    bedrooms: 1,
    bathrooms: 1,
    surface: 28,
    lat: 14.7045,
    lng: -17.4627,
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    ],
    amenities: ['Eau courante', 'Électricité'],
    status: ListingStatus.ACTIVE,
    ownerKey: 'pilot_bailleur_1',
  },
];

async function main() {
  console.log('Seeding pilot data...');

  // Upsert users
  const userMap: Record<string, string> = {};
  for (const u of PILOT_USERS) {
    const user = await prisma.user.upsert({
      where: { clerkId: u.clerkId },
      update: {},
      create: u,
    });
    userMap[u.clerkId] = user.id;
    console.log(`  User: ${u.email} (${u.roles.join(', ')})`);
  }

  // Upsert listings
  for (const l of PILOT_LISTINGS) {
    const { ownerKey, ...listingData } = l;
    const ownerId = userMap[ownerKey];
    const existing = await prisma.listing.findFirst({
      where: { title: l.title, ownerId },
    });
    if (!existing) {
      await prisma.listing.create({
        data: { ...listingData, ownerId },
      });
      console.log(`  Listing: ${l.title}`);
    } else {
      console.log(`  Listing already exists: ${l.title}`);
    }
  }

  console.log('\nPilot seed completed.');
  console.log('Accounts:');
  PILOT_USERS.forEach((u) =>
    console.log(`  ${u.roles.join('+')} — ${u.email}`),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
