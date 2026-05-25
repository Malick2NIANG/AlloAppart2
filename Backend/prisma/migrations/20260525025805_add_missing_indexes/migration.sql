-- CreateIndex
CREATE INDEX "message_rooms_listingId_idx" ON "message_rooms"("listingId");

-- CreateIndex
CREATE INDEX "messages_roomId_idx" ON "messages"("roomId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "reviews_listingId_idx" ON "reviews"("listingId");

-- CreateIndex
CREATE INDEX "reviews_authorId_idx" ON "reviews"("authorId");
