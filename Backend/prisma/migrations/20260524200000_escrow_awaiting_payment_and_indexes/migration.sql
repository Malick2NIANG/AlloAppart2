-- AlterEnum
-- ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL < 12.
-- Prisma will run this migration outside a transaction if the DB requires it.
ALTER TYPE "EscrowStatus" ADD VALUE 'AWAITING_PAYMENT' BEFORE 'HELD';

-- AlterTable: change default escrowStatus to AWAITING_PAYMENT
ALTER TABLE "bookings" ALTER COLUMN "escrowStatus" SET DEFAULT 'AWAITING_PAYMENT';

-- CreateIndex
CREATE INDEX "listings_ownerId_idx" ON "listings"("ownerId");

-- CreateIndex
CREATE INDEX "bookings_tenantId_idx" ON "bookings"("tenantId");

-- CreateIndex
CREATE INDEX "bookings_listingId_idx" ON "bookings"("listingId");
