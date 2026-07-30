-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FRAUD', 'WRONG_PRICE', 'WRONG_PHOTOS', 'ALREADY_RENTED', 'WRONG_LOCATION', 'OFFENSIVE', 'OTHER');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_listingId_idx" ON "reports"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_listingId_reporterId_key" ON "reports"("listingId", "reporterId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
