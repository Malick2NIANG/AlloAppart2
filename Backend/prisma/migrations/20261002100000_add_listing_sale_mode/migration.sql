-- Nouveaux types de biens réservés à la vente directe (agences abonnées actives)
ALTER TYPE "ListingType" ADD VALUE 'TERRAIN';
ALTER TYPE "ListingType" ADD VALUE 'MAISON';
ALTER TYPE "ListingType" ADD VALUE 'LOCAL_COMMERCIAL';

-- Mode de transaction d'une annonce : LOCATION (comportement historique) ou VENTE
CREATE TYPE "TransactionType" AS ENUM ('LOCATION', 'VENTE');

-- Listings : mode de transaction, LOCATION par défaut (comportement inchangé)
ALTER TABLE "listings" ADD COLUMN "transactionType" "TransactionType" NOT NULL DEFAULT 'LOCATION';

-- Users : numéro WhatsApp Business de l'agence, distinct du téléphone d'appel (agencyPhone)
ALTER TABLE "users" ADD COLUMN "agencyWhatsapp" TEXT;
