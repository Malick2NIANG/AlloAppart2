-- AlterEnum
ALTER TYPE "VerifStatus" ADD VALUE 'REQUESTED';

-- DropForeignKey
ALTER TABLE "verifications" DROP CONSTRAINT "verifications_agentId_fkey";

-- AlterTable
ALTER TABLE "verifications" ALTER COLUMN "agentId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
