-- AlterTable: slug unique pour les vitrines PRO_AGENCE
ALTER TABLE "users" ADD COLUMN "agencySlug" VARCHAR(80);
CREATE UNIQUE INDEX "users_agencySlug_key" ON "users"("agencySlug");
