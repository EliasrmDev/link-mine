-- Add metadata fields to Bookmark: icon, reminderDate, lastAccessed

ALTER TABLE "Bookmark" ADD COLUMN "icon"         TEXT;
ALTER TABLE "Bookmark" ADD COLUMN "reminderDate" TIMESTAMP(3);
ALTER TABLE "Bookmark" ADD COLUMN "lastAccessed" TIMESTAMP(3);

CREATE INDEX "Bookmark_reminderDate_idx" ON "Bookmark"("reminderDate");
