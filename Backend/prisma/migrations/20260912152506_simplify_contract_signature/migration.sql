-- AlterTable
ALTER TABLE "contracts" DROP COLUMN "finalPdfUrl",
DROP COLUMN "firstSignedAt",
DROP COLUMN "firstSignedById",
DROP COLUMN "firstSignedPdfUrl",
DROP COLUMN "secondSignedAt",
DROP COLUMN "status";

-- DropEnum
DROP TYPE "ContractStatus";
