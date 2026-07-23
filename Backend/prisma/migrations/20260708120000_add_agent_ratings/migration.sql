-- CreateTable: agent_ratings
CREATE TABLE "agent_ratings" (
    "id"             TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "agentId"        TEXT NOT NULL,
    "raterId"        TEXT NOT NULL,
    "rating"         INTEGER NOT NULL,
    "comment"        TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_ratings_pkey"                PRIMARY KEY ("id"),
    CONSTRAINT "agent_ratings_verificationId_key"  UNIQUE ("verificationId"),
    CONSTRAINT "agent_ratings_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agent_ratings_agentId_fkey"         FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agent_ratings_raterId_fkey"         FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "agent_ratings_agentId_idx" ON "agent_ratings"("agentId");
