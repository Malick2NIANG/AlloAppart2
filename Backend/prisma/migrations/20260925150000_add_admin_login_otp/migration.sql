-- Remplace le TOTP Clerk (fonctionnalité payante sur ce plan) par un code de
-- connexion envoyé par email à chaque connexion admin, cf. décision du
-- 2026-09-25.

-- CreateTable
CREATE TABLE "admin_login_otps" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSalt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_login_otps_adminId_idx" ON "admin_login_otps"("adminId");

-- CreateTable
CREATE TABLE "admin_verified_sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_verified_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_verified_sessions_adminId_sessionId_key" ON "admin_verified_sessions"("adminId", "sessionId");
