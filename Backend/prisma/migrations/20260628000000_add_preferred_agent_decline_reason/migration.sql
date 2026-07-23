-- Migration: add preferredAgentId and declineReason to verifications
-- Run: npx prisma migrate deploy

ALTER TABLE "verifications"
  ADD COLUMN IF NOT EXISTS "preferredAgentId" TEXT,
  ADD COLUMN IF NOT EXISTS "declineReason"    TEXT;

ALTER TABLE "verifications"
  ADD CONSTRAINT "verifications_preferredAgentId_fkey"
  FOREIGN KEY ("preferredAgentId")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
