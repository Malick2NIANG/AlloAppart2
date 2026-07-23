-- Ajout du statut DECLINE_PENDING pour les demandes de déclin en attente d'approbation admin
ALTER TYPE "VerifStatus" ADD VALUE 'DECLINE_PENDING';
