-- Archivage d'une conversation (façon WhatsApp) : état PAR utilisateur, donc
-- table à part plutôt qu'un booléen sur message_rooms — un même roomId peut
-- être archivé pour l'un des participants et rester actif pour l'autre.

CREATE TABLE "archived_rooms" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "archived_rooms_userId_roomId_key" ON "archived_rooms"("userId", "roomId");
CREATE INDEX "archived_rooms_roomId_idx" ON "archived_rooms"("roomId");
