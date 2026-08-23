-- AlterEnum
-- ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL < 12.
-- Prisma will run this migration outside a transaction if the DB requires it.
ALTER TYPE "EscrowStatus" ADD VALUE 'DISPUTED' BEFORE 'RELEASED';

-- AlterTable: signalement de non-conformité (Article 9 des CGU, fenêtre de 24h)
ALTER TABLE "bookings" ADD COLUMN "disputeReason" TEXT;
ALTER TABLE "bookings" ADD COLUMN "disputeEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "bookings" ADD COLUMN "disputedAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "disputeResolvedAt" TIMESTAMP(3);
