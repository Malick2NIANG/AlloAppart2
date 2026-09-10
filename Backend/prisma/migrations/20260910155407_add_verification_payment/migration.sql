-- CreateTable
CREATE TABLE "verification_payments" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "auditType" "AuditType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "preferredAgentId" TEXT,
    "amount" INTEGER NOT NULL,
    "paymentRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_payments_paymentRef_key" ON "verification_payments"("paymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "verification_payments_verificationId_key" ON "verification_payments"("verificationId");

-- CreateIndex
CREATE INDEX "verification_payments_listingId_idx" ON "verification_payments"("listingId");

-- AddForeignKey
ALTER TABLE "verification_payments" ADD CONSTRAINT "verification_payments_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
