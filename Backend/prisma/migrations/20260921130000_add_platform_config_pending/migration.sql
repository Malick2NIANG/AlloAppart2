-- AlterTable
ALTER TABLE "platform_config"
    ADD COLUMN "pendingStarterPriceFcfa" INTEGER,
    ADD COLUMN "pendingProPriceFcfaMonthly" INTEGER,
    ADD COLUMN "pendingNightlyCommissionRate" DOUBLE PRECISION,
    ADD COLUMN "pendingMonthlyCommissionMonths" DOUBLE PRECISION,
    ADD COLUMN "pendingAuditBasicPriceFcfa" INTEGER,
    ADD COLUMN "pendingAuditFullPriceFcfa" INTEGER,
    ADD COLUMN "pendingBoostPriceFcfa" INTEGER,
    ADD COLUMN "pendingEffectiveAt" TIMESTAMP(3),
    ADD COLUMN "pendingSetByEmail" TEXT,
    ADD COLUMN "pendingSetAt" TIMESTAMP(3);
