-- AlterTable: reply, edit, soft-delete support
ALTER TABLE "messages"
  ADD COLUMN "editedAt"  TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "replyToId" TEXT;

-- AddForeignKey
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "messages_replyToId_idx" ON "messages"("replyToId");
