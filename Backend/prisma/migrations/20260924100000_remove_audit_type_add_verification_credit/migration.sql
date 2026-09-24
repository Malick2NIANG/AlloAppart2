-- Retire le double tarif AlloVérifié BASIC/FULL (un seul type d'audit,
-- 25 000 FCFA, désormais) et introduit VerificationCredit : un crédit de
-- re-soumission gratuite accordé au bailleur quand un agent rejette (bien
-- visité mais non conforme) une vérification déjà payée.

-- 1. Colonnes auditType (plus nécessaires, un seul type d'audit)
ALTER TABLE "verifications" DROP COLUMN "auditType";
ALTER TABLE "verification_payments" DROP COLUMN "auditType";

-- 2. Enum AuditType (plus référencé nulle part)
DROP TYPE "AuditType";

-- 3. Prix FULL retiré de la configuration tarifaire (courant + programmé)
ALTER TABLE "platform_config" DROP COLUMN "auditFullPriceFcfa";
ALTER TABLE "platform_config" DROP COLUMN "pendingAuditFullPriceFcfa";

-- 4. Nouvelle table : crédit de re-soumission gratuite après rejet d'une
--    vérification déjà payée par le bailleur.
CREATE TABLE "verification_credits" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sourceVerificationId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedByVerificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "verification_credits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verification_credits_listingId_used_idx" ON "verification_credits"("listingId", "used");
CREATE INDEX "verification_credits_ownerId_idx" ON "verification_credits"("ownerId");
