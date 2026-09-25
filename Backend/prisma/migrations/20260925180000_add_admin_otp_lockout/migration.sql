-- Verrouillage anti-brute-force du code de connexion admin (2FA email) —
-- compte les échecs consécutifs indépendamment du code demandé (pas
-- rattaché à une ligne admin_login_otps précise, sinon redemander un code
-- remettrait le compteur à zéro), cf. revue de sécurité du 2026-09-25.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "adminOtpFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "adminOtpLockedUntil" TIMESTAMP(3);
