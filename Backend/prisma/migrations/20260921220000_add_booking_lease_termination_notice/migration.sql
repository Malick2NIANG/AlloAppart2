-- AlterTable
ALTER TABLE "bookings"
    ADD COLUMN "terminationRequestedAt"   TIMESTAMP(3),
    ADD COLUMN "terminationEffectiveAt"   TIMESTAMP(3),
    ADD COLUMN "terminationRequestedById" TEXT;
