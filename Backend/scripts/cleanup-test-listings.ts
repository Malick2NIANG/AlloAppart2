/**
 * cleanup-test-listings.ts — Supprime les annonces de test (seed.ts /
 * seed.pilot.ts) de la base de données, avec le même nettoyage en cascade
 * que Listing.remove() (verifications, agentRatings, reviews, messages,
 * messageRooms, bookings, boostPayments) pour ne rien laisser d'orphelin.
 *
 * Repère les annonces "test" par le compte propriétaire :
 *   - seed.ts       → clerkId commence par "user_seed_" ou email finit par "@seed.dev"
 *   - seed.pilot.ts → clerkId commence par "pilot_"     ou email finit par "@test.sn"
 *
 * Affiche aussi, à part, les annonces dont le TITRE contient "test" mais dont
 * le propriétaire n'est pas un compte seed — probablement des annonces
 * créées à la main pendant tes propres tests. Celles-là ne sont PAS
 * supprimées automatiquement (pour éviter un faux positif) : vérifie-les et
 * supprime-les à la main depuis /bailleur/listings ou /espace/listings si
 * elles sont bien à jeter.
 *
 * Usage :
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-test-listings.ts             # dry-run (par défaut)
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-test-listings.ts --delete     # supprime pour de vrai
 *
 * Après suppression, réindexe la recherche : bouton "Réindexer" dans
 * /espace/config (ou POST /search/reindex en ADMIN).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://allo:allo_secret@localhost:5433/allo_appart';
const pool = new Pool({ connectionString: DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DELETE = process.argv.includes('--delete');

function isSeedOwner(owner: { clerkId: string; email: string }): boolean {
  return (
    owner.clerkId.startsWith('user_seed_') ||
    owner.clerkId.startsWith('pilot_') ||
    owner.email.endsWith('@seed.dev') ||
    owner.email.endsWith('@test.sn')
  );
}

async function removeListingCascade(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const verifications = await tx.verification.findMany({
      where: { listingId: id },
      select: { id: true },
    });
    if (verifications.length > 0) {
      await tx.agentRating.deleteMany({
        where: { verificationId: { in: verifications.map((v) => v.id) } },
      });
    }
    await tx.verification.deleteMany({ where: { listingId: id } });
    await tx.review.deleteMany({ where: { listingId: id } });

    const rooms = await tx.messageRoom.findMany({
      where: { listingId: id },
      select: { id: true },
    });
    if (rooms.length > 0) {
      await tx.message.deleteMany({
        where: { roomId: { in: rooms.map((r) => r.id) } },
      });
    }
    await tx.messageRoom.deleteMany({ where: { listingId: id } });
    await tx.booking.deleteMany({ where: { listingId: id } });
    await tx.boostPayment.deleteMany({ where: { listingId: id } });
    await tx.listing.delete({ where: { id } });
  });
}

async function main() {
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      title: true,
      city: true,
      owner: { select: { clerkId: true, email: true } },
    },
  });

  const seedListings = listings.filter((l) => isSeedOwner(l.owner));
  const suspectTitleListings = listings.filter(
    (l) => !isSeedOwner(l.owner) && l.title.toLowerCase().includes('test'),
  );

  console.log(`\n📋 ${seedListings.length} annonce(s) de comptes seed/pilot :`);
  for (const l of seedListings) {
    console.log(`   - [${l.id}] "${l.title}" — ${l.city} (${l.owner.email})`);
  }

  if (suspectTitleListings.length > 0) {
    console.log(
      `\n⚠️  ${suspectTitleListings.length} annonce(s) avec "test" dans le titre, propriétaire NON-seed (à vérifier à la main) :`,
    );
    for (const l of suspectTitleListings) {
      console.log(`   - [${l.id}] "${l.title}" — ${l.city} (${l.owner.email})`);
    }
  }

  if (!DELETE) {
    console.log(
      `\n🔎 Dry-run — rien n'a été supprimé. Relance avec --delete pour supprimer les ${seedListings.length} annonce(s) seed/pilot listées ci-dessus.`,
    );
    return;
  }

  console.log(`\n🗑️  Suppression de ${seedListings.length} annonce(s)...`);
  for (const l of seedListings) {
    await removeListingCascade(l.id);
    console.log(`   ✅ supprimée : [${l.id}] "${l.title}"`);
  }
  console.log(
    `\n🎉 Terminé. N'oublie pas de réindexer la recherche (bouton "Réindexer" dans /espace/config).`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
