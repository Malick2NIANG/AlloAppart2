-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
