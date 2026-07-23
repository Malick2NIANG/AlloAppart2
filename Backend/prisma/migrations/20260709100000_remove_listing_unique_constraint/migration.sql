-- Remove the overly strict @unique constraint on listingId in verifications.
-- A listing can have multiple verifications over time (e.g. after DONE or REJECTED).
-- The business rule (no active duplicate) is enforced at the service layer.

ALTER TABLE "verifications" DROP CONSTRAINT IF EXISTS "verifications_listingId_key";
