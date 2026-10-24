/**
 * seed.demo.ts — Données de démonstration du film de lancement AlloAppart.
 *
 * Lot RÉDUIT (prompt 02) : comptes de démo + les 9 annonces filmées en
 * gros plan (L01, L02, L12, et les annonces de vente L18-L23), avec leurs
 * photos réelles (voir Frontend/motion/demo/photos/credits.json). Les 14
 * autres annonces du catalogue complet (PLAN_DEMO.md § 2) restent à
 * ajouter avant les prompts de scène qui montrent le catalogue (05, 06,
 * 11, 12) — curation photo complète requise au préalable.
 *
 * Garde-fous (PLAN_DEMO.md § 5) :
 *   - refuse de s'exécuter si la base cible ne se termine pas par
 *     `_demo` (sauf ALLOW_NON_DEMO_DB=1) ;
 *   - refuse si NODE_ENV=production ;
 *   - idempotent : upsert par clerkId (users) et par UUID déterministe
 *     (listings, verifications).
 *
 * Usage :
 *   DATABASE_URL="postgresql://allo:allo_secret@localhost:5433/allo_appart_demo" \
 *     npx ts-node -r tsconfig-paths/register prisma/seed.demo.ts
 *
 *   Pour terminer la vérification V3 (deuxième état de la scène 07,
 *   RAPPORT_00.md « Décisions validées (suite) » § 2) :
 *   DATABASE_URL="..." npx ts-node -r tsconfig-paths/register prisma/seed.demo.ts --finish-v3
 */

import path from 'node:path';
import fs from 'node:fs';
import {
  PrismaClient,
  Role,
  ListingType,
  ListingStatus,
  TransactionType,
  RentalMode,
  VerifStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL ?? '';
const dbName = databaseUrl.split('/').pop()?.split('?')[0] ?? '';
if (!dbName.endsWith('_demo') && process.env.ALLOW_NON_DEMO_DB !== '1') {
  throw new Error(
    `Garde-fou : la base ciblée ("${dbName}") ne se termine pas par "_demo". ` +
      `Abandon pour éviter d'écrire dans la base de développement. ` +
      `Cible attendue : allo_appart_demo. (ALLOW_NON_DEMO_DB=1 pour forcer.)`,
  );
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Garde-fou : NODE_ENV=production — seed de démo refusé.');
}
console.log(`Seed de démo — base ciblée : ${dbName}`);

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Comptes (lus depuis capture/.credentials.env, écrit par
//     provision-demo-accounts.mjs — jamais de secret en dur ici) ──────────

const CREDENTIALS_PATH = path.resolve(
  __dirname,
  '../../Frontend/motion/capture/.credentials.env',
);
if (!fs.existsSync(CREDENTIALS_PATH)) {
  throw new Error(
    `${CREDENTIALS_PATH} introuvable — lance d'abord ` +
      `node Frontend/motion/scripts/provision-demo-accounts.mjs`,
  );
}
process.loadEnvFile(CREDENTIALS_PATH);

function readPersona(envKey: string): { email: string; clerkId: string } {
  const email = process.env[`${envKey}_EMAIL`];
  const clerkId = process.env[`${envKey}_CLERK_ID`];
  if (!email || !clerkId) {
    throw new Error(
      `${envKey}_EMAIL / ${envKey}_CLERK_ID absents de ${CREDENTIALS_PATH}`,
    );
  }
  return { email, clerkId };
}

interface DemoUser {
  key: string;
  email: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  agencyName?: string;
  agencySlug?: string;
  agencyBio?: string;
  agencyPhone?: string;
  agencyAddress?: string;
  agencyColor?: string;
  profileViews?: number;
  coverageZone?: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    key: 'demo-locataire',
    ...readPersona('DEMO_LOCATAIRE'),
    firstName: 'Fatou',
    lastName: 'Ndiaye',
    roles: [Role.LOCATAIRE],
  },
  {
    key: 'demo-bailleur',
    ...readPersona('DEMO_BAILLEUR'),
    firstName: 'Moussa',
    lastName: 'Sarr',
    roles: [Role.LOCATAIRE, Role.BAILLEUR],
  },
  {
    key: 'demo-bailleur-2',
    ...readPersona('DEMO_BAILLEUR_2'),
    firstName: 'Aminata',
    lastName: 'Diallo',
    roles: [Role.LOCATAIRE, Role.BAILLEUR],
  },
  {
    key: 'demo-agence',
    ...readPersona('DEMO_AGENCE'),
    firstName: 'Ousmane',
    lastName: 'Ba',
    roles: [Role.PRO_AGENCE],
    agencyName: 'Atlantique Horizon Immobilier',
    agencySlug: 'atlantique-horizon-immobilier',
    agencyBio:
      'Agence immobilière basée à Dakar, spécialisée dans la location et la vente de biens résidentiels et commerciaux au Sénégal.',
    agencyPhone: '+221 33 832 69 72',
    // agencyWhatsapp volontairement non renseigné (PLAN_DEMO.md « Décisions
    // validées — correction de connexion » / numéro ligne fixe, pas de
    // WhatsApp Business confirmé) — la fiche affichera "Appeler" seul.
    agencyAddress: 'Mermoz, Dakar',
    agencyColor: 'gold',
    profileViews: 1240,
  },
  {
    key: 'demo-agent',
    ...readPersona('DEMO_AGENT'),
    firstName: 'Cheikh',
    lastName: 'Mbaye',
    roles: [Role.AGENT_TERRAIN],
    coverageZone: 'Dakar',
  },
  {
    key: 'demo-agent-2',
    ...readPersona('DEMO_AGENT_2'),
    firstName: 'Mariama',
    lastName: 'Sow',
    roles: [Role.AGENT_TERRAIN],
    coverageZone: 'Thiès, Mbour',
  },
  {
    key: 'demo-locataire-2',
    ...readPersona('DEMO_LOCATAIRE_2'),
    firstName: 'Ndeye',
    lastName: 'Seck',
    roles: [Role.LOCATAIRE],
  },
  {
    key: 'demo-locataire-3',
    ...readPersona('DEMO_LOCATAIRE_3'),
    firstName: 'Pape',
    lastName: 'Gueye',
    roles: [Role.LOCATAIRE],
  },
];

// ─── Photos (credits.json — jamais d'URL inventée) ────────────────────────

interface PhotoCredit {
  listingKey: string;
  order: number;
  cdnUrl: string;
  cloudinaryUrl?: string;
}
const creditsPath = path.resolve(
  __dirname,
  '../../Frontend/motion/demo/photos/credits.json',
);
const credits = JSON.parse(fs.readFileSync(creditsPath, 'utf8')) as {
  photos: PhotoCredit[];
};
function photosFor(listingKey: string): string[] {
  // `cloudinaryUrl` (allo-appart/demo/, via upload-demo-photos.mjs) — jamais
  // le `cdnUrl` d'origine (Pexels) : non whitelisté dans next.config.ts,
  // et on ne le modifie pas (règle du prompt 02 / consigne explicite).
  return credits.photos
    .filter((p) => p.listingKey === listingKey)
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      if (!p.cloudinaryUrl) {
        throw new Error(
          `${p.listingKey} #${p.order} : cloudinaryUrl absent — lance d'abord node Frontend/motion/scripts/upload-demo-photos.mjs`,
        );
      }
      return p.cloudinaryUrl;
    });
}

// ─── Annonces — lot réduit, PLAN_DEMO.md § 2 (seules les 9 filmées en
//     gros plan : L01, L02, L12, L18-L23) ─────────────────────────────────

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

interface DemoListing {
  key: string;
  title: string;
  description: string;
  type: ListingType;
  transactionType: TransactionType;
  rentalMode: RentalMode;
  city: string;
  region: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  pricePerNight?: number;
  rooms?: number;
  beds?: number;
  baths?: number;
  surface?: number;
  amenities: string[];
  ownerKey: string;
}

const DEMO_LISTINGS: DemoListing[] = [
  {
    key: 'demo-L01',
    title: 'Appartement F3 meublé avec vue mer',
    description:
      "Appartement meublé de 3 pièces au 4ᵉ étage, vue sur l'océan. " +
      'Climatisation, wifi et place de parking sécurisée. À 5 minutes de la Corniche.',
    type: ListingType.APPARTEMENT,
    transactionType: TransactionType.LOCATION,
    rentalMode: RentalMode.MIXED,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Almadies, Dakar',
    lat: 14.7447,
    lng: -17.5131,
    price: 950000,
    pricePerNight: 85000,
    rooms: 3,
    beds: 2,
    baths: 2,
    surface: 110,
    amenities: ['Climatisation', 'WiFi', 'Parking', 'Gardien'],
    ownerKey: 'demo-bailleur',
  },
  {
    key: 'demo-L02',
    title: 'Studio meublé à Mermoz',
    description:
      'Studio meublé et climatisé à Mermoz, idéal pour un séjour court ou longue durée. ' +
      'Wifi inclus, proche des commerces.',
    type: ListingType.STUDIO,
    transactionType: TransactionType.LOCATION,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Mermoz, Dakar',
    lat: 14.7128,
    lng: -17.4701,
    price: 25000,
    pricePerNight: 25000,
    rooms: 1,
    beds: 1,
    baths: 1,
    surface: 35,
    amenities: ['Climatisation', 'WiFi'],
    ownerKey: 'demo-bailleur',
  },
  {
    key: 'demo-L12',
    title: 'Appartement F2 à Liberté 6',
    description:
      'Appartement 2 pièces calme à Liberté 6, proche des axes principaux et des commerces de quartier.',
    type: ListingType.APPARTEMENT,
    transactionType: TransactionType.LOCATION,
    rentalMode: RentalMode.MONTHLY,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Liberté 6, Dakar',
    lat: 14.7045,
    lng: -17.461,
    price: 300000,
    rooms: 2,
    beds: 1,
    baths: 1,
    surface: 70,
    amenities: [],
    ownerKey: 'demo-bailleur-2',
  },
  {
    key: 'demo-L18',
    title: 'Terrain titré de 300 m² à Diamniadio',
    description:
      'Terrain titré de 300 m² à Diamniadio, idéal pour un projet résidentiel. Accès direct à la voirie.',
    type: ListingType.TERRAIN,
    transactionType: TransactionType.VENTE,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Diamniadio',
    region: 'Dakar',
    address: 'Diamniadio',
    lat: 14.7236,
    lng: -17.1844,
    price: 30000000,
    surface: 300,
    amenities: [],
    ownerKey: 'demo-agence',
  },
  {
    key: 'demo-L19',
    title: 'Villa à vendre à Saly Portudal',
    description:
      'Villa de 4 chambres avec piscine et jardin à Saly Portudal, à proximité des plages.',
    type: ListingType.VILLA,
    transactionType: TransactionType.VENTE,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Saly',
    region: 'Thiès',
    address: 'Saly Portudal',
    lat: 14.4505,
    lng: -17.0176,
    price: 125000000,
    rooms: 4,
    beds: 4,
    baths: 3,
    surface: 600,
    amenities: ['Piscine', 'Jardin'],
    ownerKey: 'demo-agence',
  },
  {
    key: 'demo-L20',
    title: 'Maison à vendre à Thiès',
    description: 'Maison de 5 pièces à Thiès, quartier résidentiel calme.',
    type: ListingType.MAISON,
    transactionType: TransactionType.VENTE,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Thiès',
    region: 'Thiès',
    address: 'Thiès',
    lat: 14.791,
    lng: -16.9359,
    price: 48000000,
    rooms: 5,
    beds: 4,
    baths: 2,
    surface: 250,
    amenities: [],
    ownerKey: 'demo-agence',
  },
  {
    key: 'demo-L21',
    title: 'Appartement F4 à vendre aux Almadies',
    description:
      'Appartement de standing de 4 pièces aux Almadies, 150 m², finitions haut de gamme.',
    type: ListingType.APPARTEMENT,
    transactionType: TransactionType.VENTE,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Dakar',
    region: 'Dakar',
    address: 'Almadies, Dakar',
    lat: 14.7447,
    lng: -17.5131,
    price: 165000000,
    rooms: 4,
    beds: 3,
    baths: 2,
    surface: 150,
    amenities: [],
    ownerKey: 'demo-agence',
  },
  {
    key: 'demo-L22',
    title: 'Local commercial au centre de Kaolack',
    description:
      'Local commercial de 180 m² au centre de Kaolack, idéal commerce ou bureaux.',
    type: ListingType.LOCAL_COMMERCIAL,
    transactionType: TransactionType.VENTE,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Kaolack',
    region: 'Kaolack',
    address: 'Centre-ville, Kaolack',
    lat: 14.1612,
    lng: -16.0728,
    price: 60000000,
    surface: 180,
    amenities: [],
    ownerKey: 'demo-agence',
  },
  {
    key: 'demo-L23',
    title: 'Terrain de 500 m² à Saly',
    description: 'Terrain de 500 m² à Saly, proche des zones touristiques.',
    type: ListingType.TERRAIN,
    transactionType: TransactionType.VENTE,
    rentalMode: RentalMode.NIGHTLY,
    city: 'Saly',
    region: 'Thiès',
    address: 'Saly',
    lat: 14.4505,
    lng: -17.0176,
    price: 22000000,
    surface: 500,
    amenities: [],
    ownerKey: 'demo-agence',
  },
];

// UUID v5 déterministes (namespace fixe du projet, RFC 4122) — stables
// entre deux exécutions, pour que l'upsert retrouve toujours la même
// ligne. Implémentation directe avec `crypto` (pas de nouvelle
// dépendance) : SHA-1(namespace_bytes + name), bits de version/variante
// posés sur l'octet 6 et 8 du digest.
import { createHash } from 'node:crypto';
const DEMO_NAMESPACE_HEX = '2f6a1a6a9b7a4a1a8b1a0a11a0ff3de0';
function demoUuid(key: string): string {
  const nsBytes = Buffer.from(DEMO_NAMESPACE_HEX, 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([nsBytes, Buffer.from(key, 'utf8')]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function main() {
  console.log('Seeding demo data...');

  // 1. Comptes
  const userIdByKey: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const { key, ...data } = u;
    const user = await prisma.user.upsert({
      where: { clerkId: data.clerkId },
      update: {
        ...data,
        termsAcceptedAt: daysAgo(60),
        bailleurTermsAcceptedAt:
          data.roles.includes(Role.BAILLEUR) ||
          data.roles.includes(Role.PRO_AGENCE)
            ? daysAgo(60)
            : null,
        mustChangePassword: false,
        locale: 'fr',
        isSuspended: false,
      },
      create: {
        ...data,
        termsAcceptedAt: daysAgo(60),
        bailleurTermsAcceptedAt:
          data.roles.includes(Role.BAILLEUR) ||
          data.roles.includes(Role.PRO_AGENCE)
            ? daysAgo(60)
            : null,
        mustChangePassword: false,
        locale: 'fr',
        isSuspended: false,
      },
    });
    userIdByKey[key] = user.id;
    console.log(`  Compte : ${data.email} (${data.roles.join(', ')})`);
  }

  // 2. Abonnement PRO actif pour l'agence
  const agenceId = userIdByKey['demo-agence'];
  await prisma.subscription.upsert({
    where: { userId: agenceId },
    update: {
      plan: 'PRO',
      status: 'ACTIVE',
      monthlyFee: 150000,
      startDate: daysAgo(60),
      endDate: null,
    },
    create: {
      userId: agenceId,
      plan: 'PRO',
      status: 'ACTIVE',
      monthlyFee: 150000,
      startDate: daysAgo(60),
    },
  });
  console.log('  Abonnement PRO actif : demo-agence');

  // 3. Annonces
  const listingIdByKey: Record<string, string> = {};
  for (const l of DEMO_LISTINGS) {
    const { key, ownerKey, ...data } = l;
    const id = demoUuid(key);
    const images = photosFor(key);
    if (images.length < 3) {
      throw new Error(
        `${key} : moins de 3 photos dans credits.json (${images.length}) — seed refusé.`,
      );
    }
    await prisma.listing.upsert({
      where: { id },
      update: {
        ...data,
        images,
        status: ListingStatus.ACTIVE,
        ownerId: userIdByKey[ownerKey],
      },
      create: {
        id,
        ...data,
        images,
        status: ListingStatus.ACTIVE,
        ownerId: userIdByKey[ownerKey],
      },
    });
    listingIdByKey[key] = id;
    console.log(`  Annonce : ${l.title} (${images.length} photos)`);
  }

  // 4. AlloVérifié — V1 (L01, DONE), V2 (L12, DONE), V3 (L02, SCHEDULED
  //    puis DONE avec --finish-v3, RAPPORT_00.md « Décisions validées
  //    (suite) » § 2 : deux états successifs dans la même session).
  const agentId = userIdByKey['demo-agent'];
  const agent2Id = userIdByKey['demo-agent-2'];
  const finishV3 = process.argv.includes('--finish-v3');

  await prisma.verification.upsert({
    where: { id: demoUuid('demo-V1') },
    update: {
      listingId: listingIdByKey['demo-L01'],
      agentId,
      status: VerifStatus.DONE,
      scheduledAt: daysAgo(24),
      completedAt: daysAgo(20),
      notes:
        "Surface, pièces et équipements conformes à l'annonce. Accès sécurisé vérifié.",
      photos: photosFor('demo-L01').slice(0, 2),
    },
    create: {
      id: demoUuid('demo-V1'),
      listingId: listingIdByKey['demo-L01'],
      agentId,
      status: VerifStatus.DONE,
      scheduledAt: daysAgo(24),
      completedAt: daysAgo(20),
      notes:
        "Surface, pièces et équipements conformes à l'annonce. Accès sécurisé vérifié.",
      photos: photosFor('demo-L01').slice(0, 2),
    },
  });
  await prisma.listing.update({
    where: { id: listingIdByKey['demo-L01'] },
    data: { isVerified: true, verifiedAt: daysAgo(20) },
  });
  console.log('  Vérification V1 (L01) : DONE');

  await prisma.verification.upsert({
    where: { id: demoUuid('demo-V2') },
    update: {
      listingId: listingIdByKey['demo-L12'],
      agentId: agent2Id,
      status: VerifStatus.DONE,
      scheduledAt: daysAgo(49),
      completedAt: daysAgo(45),
      notes: 'Visite conforme. Quartier calme, accès facile.',
      photos: photosFor('demo-L12').slice(0, 2),
    },
    create: {
      id: demoUuid('demo-V2'),
      listingId: listingIdByKey['demo-L12'],
      agentId: agent2Id,
      status: VerifStatus.DONE,
      scheduledAt: daysAgo(49),
      completedAt: daysAgo(45),
      notes: 'Visite conforme. Quartier calme, accès facile.',
      photos: photosFor('demo-L12').slice(0, 2),
    },
  });
  await prisma.listing.update({
    where: { id: listingIdByKey['demo-L12'] },
    data: { isVerified: true, verifiedAt: daysAgo(45) },
  });
  console.log('  Vérification V2 (L12) : DONE');

  const v3ScheduledAt = new Date();
  v3ScheduledAt.setMinutes(
    Math.floor(v3ScheduledAt.getMinutes() / 15) * 15,
    0,
    0,
  ); // arrondi au quart d'heure
  await prisma.verification.upsert({
    where: { id: demoUuid('demo-V3') },
    update: finishV3
      ? {
          status: VerifStatus.DONE,
          completedAt: new Date(),
          notes: "Studio conforme à l'annonce. Équipements vérifiés.",
          photos: photosFor('demo-L02'),
        }
      : {
          listingId: listingIdByKey['demo-L02'],
          agentId,
          status: VerifStatus.SCHEDULED,
          scheduledAt: v3ScheduledAt,
        },
    create: {
      id: demoUuid('demo-V3'),
      listingId: listingIdByKey['demo-L02'],
      agentId,
      status: VerifStatus.SCHEDULED,
      scheduledAt: v3ScheduledAt,
    },
  });
  if (finishV3) {
    await prisma.listing.update({
      where: { id: listingIdByKey['demo-L02'] },
      data: { isVerified: true, verifiedAt: new Date() },
    });
    console.log('  Vérification V3 (L02) : DONE (--finish-v3)');
  } else {
    // Retour à l'état « planifié » (plan 1 de la scène 07) — y compris si
    // une exécution précédente avait déjà posé isVerified via --finish-v3.
    await prisma.listing.update({
      where: { id: listingIdByKey['demo-L02'] },
      data: { isVerified: false, verifiedAt: null },
    });
    console.log(
      `  Vérification V3 (L02) : SCHEDULED (${v3ScheduledAt.toISOString()})`,
    );
  }

  console.log('\nSeed de démo terminé.');
  console.log(
    `Lot réduit : ${DEMO_LISTINGS.length} annonces, ${DEMO_USERS.length} comptes, 3 vérifications.`,
  );
  console.log(
    'Annonces non encore seedées (photos à curer) : L03-L11, L13-L17 — voir credits.json._pending_curation.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
