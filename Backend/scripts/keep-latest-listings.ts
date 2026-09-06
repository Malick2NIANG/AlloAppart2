/**
 * keep-latest-listings.ts — Ne garde que les N annonces les plus récentes
 * (par date de création) et supprime toutes les autres, avec le même
 * nettoyage en cascade que Listing.remove() (verifications, agentRatings,
 * reviews, messages, messageRooms, bookings, boostPayments).
 *
 * Usage :
 *   npx ts-node -r tsconfig-paths/register scripts/keep-latest-listings.ts             # dry-run (par défaut), garde 2
 *   npx ts-node -r tsconfig-paths/register scripts/keep-latest-listings.ts --delete     # supprime pour de vrai
 *   npx ts-node -r tsconfig-paths/register scripts/keep-latest-listings.ts --delete --keep 3   # garde les 3 plus récentes
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
const keepArgIndex = process.argv.indexOf('--keep');
const KEEP = keepArgIndex !== -1 ? parseInt(process.argv[keepArgIndex + 1], 10) : 2;

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
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      city: true,
      status: true,
      createdAt: true,
      owner: { select: { email: true } },
    },
  });

  const toKeep = listings.slice(0, KEEP);
  const toDelete = listings.slice(KEEP);

  console.log(`\n✅ ${toKeep.length} annonce(s) conservée(s) (les plus récentes) :`);
  for (const l of toKeep) {
    console.log(`   - [${l.id}] "${l.title}" — ${l.city} — ${l.status} — ${l.createdAt.toISOString()} (${l.owner.email})`);
  }

  console.log(`\n🗑️  ${toDelete.length} annonce(s) à supprimer :`);
  for (const l of toDelete) {
    console.log(`   - [${l.id}] "${l.title}" — ${l.city} — ${l.status} — ${l.createdAt.toISOString()} (${l.owner.email})`);
  }

  if (!DELETE) {
    console.log(`\n🔎 Dry-run — rien n'a été supprimé. Relance avec --delete pour supprimer les ${toDelete.length} annonce(s) listées ci-dessus.`);
    return;
  }

  console.log(`\n🗑️  Suppression de ${toDelete.length} annonce(s)...`);
  for (const l of toDelete) {
    await removeListingCascade(l.id);
    console.log(`   ✅ supprimée : [${l.id}] "${l.title}"`);
  }
  console.log(`\n🎉 Terminé. ${toKeep.length} annonce(s) restante(s). N'oublie pas de réindexer la recherche (bouton "Réindexer" dans /espace/config).`);
}

main()
  .catch((e) => { console.error('❌ Erreur:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
