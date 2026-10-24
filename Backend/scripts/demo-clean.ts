/**
 * demo-clean.ts — Supprime toutes les données de démonstration du film de
 * lancement (PLAN_DEMO.md § 5 « Supprimable d'une commande »).
 *
 * Supprime, dans l'ordre des dépendances (même logique que
 * Backend/scripts/cleanup-test-listings.ts) :
 *   - les vérifications, messages/salons, réservations, avis, favoris,
 *     notifications, abonnement liés aux annonces/comptes demo- ;
 *   - les annonces demo- (par UUID déterministe, préfixe demo-L) ;
 *   - les comptes demo- (par e-mail +clerk_test@example.com) — en base
 *     ET côté Clerk (API, mêmes identifiants que
 *     Frontend/motion/scripts/provision-demo-accounts.mjs).
 *
 * Ne supprime PAS la base `allo_appart_demo` elle-même (voir `demo:drop`,
 * une suppression de base complète, à faire manuellement si besoin —
 * cf. PLAN_DEMO.md § 5).
 *
 * Usage :
 *   DATABASE_URL="postgresql://allo:allo_secret@localhost:5433/allo_appart_demo" \
 *     npx ts-node -r tsconfig-paths/register scripts/demo-clean.ts
 */

import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL ?? '';
const dbName = databaseUrl.split('/').pop()?.split('?')[0] ?? '';
if (!dbName.endsWith('_demo') && process.env.ALLOW_NON_DEMO_DB !== '1') {
  throw new Error(
    `Garde-fou : la base ciblée ("${dbName}") ne se termine pas par "_demo". Abandon.`,
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function cleanClerkAccounts() {
  process.loadEnvFile(path.resolve(__dirname, '../.env'));
  const SECRET_KEY = process.env.CLERK_SECRET_KEY;
  if (!SECRET_KEY) {
    console.log('  (CLERK_SECRET_KEY absente — comptes Clerk non nettoyés)');
    return;
  }
  if (!SECRET_KEY.startsWith('sk_test_')) {
    console.log(
      '  (clé Clerk non-test — comptes Clerk non nettoyés par sécurité)',
    );
    return;
  }

  const DEMO_KEYS = [
    'demo-locataire',
    'demo-bailleur',
    'demo-bailleur-2',
    'demo-agence',
    'demo-agent',
    'demo-agent-2',
    'demo-locataire-2',
    'demo-locataire-3',
  ];
  for (const key of DEMO_KEYS) {
    const email = `${key}+clerk_test@example.com`;
    const res = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      },
    );
    if (!res.ok) continue;
    const users = (await res.json()) as Array<{ id: string }>;
    for (const u of users) {
      await fetch(`https://api.clerk.com/v1/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      });
      console.log(`  Compte Clerk supprimé : ${email}`);
    }
  }
}

async function main() {
  console.log(`Nettoyage des données de démo — base ciblée : ${dbName}`);

  const demoUsers = await prisma.user.findMany({
    where: {
      email: { startsWith: 'demo-', endsWith: '+clerk_test@example.com' },
    },
    select: { id: true },
  });
  const userIds = demoUsers.map((u) => u.id);

  const demoListings = await prisma.listing.findMany({
    where: { owner: { email: { startsWith: 'demo-' } } },
    select: { id: true },
  });
  const listingIds = demoListings.map((l) => l.id);

  if (listingIds.length > 0) {
    await prisma.agentRating.deleteMany({
      where: { verification: { listingId: { in: listingIds } } },
    });
    await prisma.verification.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.review.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.message.deleteMany({
      where: { room: { listingId: { in: listingIds } } },
    });
    await prisma.messageRoom.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.booking.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.boostPayment.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.verificationPayment.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.report.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });
    console.log(`  ${listingIds.length} annonce(s) demo- supprimée(s).`);
  }

  if (userIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.archivedRoom.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`  ${userIds.length} compte(s) demo- supprimé(s) en base.`);
  }

  await cleanClerkAccounts();

  console.log('\nNettoyage terminé.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
