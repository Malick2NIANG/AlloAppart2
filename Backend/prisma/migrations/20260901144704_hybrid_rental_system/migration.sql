-- CreateEnum
CREATE TYPE "RentalMode" AS ENUM ('NIGHTLY', 'MONTHLY', 'MIXED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('NIGHTLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_CARD', 'PROOF_OF_INCOME', 'GUARANTOR');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SEASONAL', 'HABITATION');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'AWAITING_FIRST_SIGNATURE', 'AWAITING_SECOND_SIGNATURE', 'FULLY_SIGNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "BookingStatus" ADD VALUE 'APPROVED';
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';
ALTER TYPE "BookingStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "BookingStatus" ADD VALUE 'TERMINATED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "bookingType" "BookingType" NOT NULL DEFAULT 'NIGHTLY',
ADD COLUMN     "depositAmount" DECIMAL(12,2),
ADD COLUMN     "terminatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "chargesIncluded" BOOLEAN,
ADD COLUMN     "cleaningFee" DECIMAL(12,2),
ADD COLUMN     "depositMonths" INTEGER,
ADD COLUMN     "minLeaseMonths" INTEGER,
ADD COLUMN     "rentalMode" "RentalMode" NOT NULL DEFAULT 'NIGHTLY';

-- CreateTable
CREATE TABLE "booking_documents" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "firstSignedPdfUrl" TEXT,
    "finalPdfUrl" TEXT,
    "firstSignedById" TEXT,
    "firstSignedAt" TIMESTAMP(3),
    "secondSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_documents_bookingId_idx" ON "booking_documents"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_bookingId_key" ON "contracts"("bookingId");

-- AddForeignKey
ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
