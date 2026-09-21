-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "starterPriceFcfa" INTEGER NOT NULL DEFAULT 75000,
    "proPriceFcfaMonthly" INTEGER NOT NULL DEFAULT 150000,
    "nightlyCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "monthlyCommissionMonths" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "auditBasicPriceFcfa" INTEGER NOT NULL DEFAULT 25000,
    "auditFullPriceFcfa" INTEGER NOT NULL DEFAULT 60000,
    "boostPriceFcfa" INTEGER NOT NULL DEFAULT 5000,
    "pinHash" TEXT NOT NULL,
    "pinSalt" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_config_otps" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_config_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_config_otps_adminId_idx" ON "admin_config_otps"("adminId");
