-- AlterTable
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "platformFee" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "landlordAmount" DECIMAL(12,2);
