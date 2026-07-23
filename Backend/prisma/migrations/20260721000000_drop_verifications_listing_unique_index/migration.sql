-- La migration précédente utilisait DROP CONSTRAINT mais c'est un INDEX UNIQUE.
-- On le supprime correctement ici.
DROP INDEX IF EXISTS "verifications_listingId_key";
