-- Phase 2: Fix RLS SET LOCAL, add indexes, add VARCHAR constraints
-- CRITICAL: SET LOCAL scopes to transaction only — safe for PgBouncer transaction pooling (Supabase)

-- 1. Update set_current_user_id to use SET LOCAL (transaction-scoped instead of session-scoped)
CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. GIN index on Bookmark.tags for array operations (hasSome, has)
CREATE INDEX IF NOT EXISTS "Bookmark_tags_gin" ON "Bookmark" USING GIN ("tags");

-- 3. Composite index for common query: bookmarks by user sorted by date
CREATE INDEX IF NOT EXISTS "Bookmark_userId_createdAt_idx" ON "Bookmark" ("userId", "createdAt" DESC);

-- 4. VARCHAR constraints — enforce maximum lengths at the database level
ALTER TABLE "Bookmark" ALTER COLUMN "url" TYPE VARCHAR(2048);
ALTER TABLE "Bookmark" ALTER COLUMN "title" TYPE VARCHAR(500);
ALTER TABLE "Folder" ALTER COLUMN "name" TYPE VARCHAR(100);
ALTER TABLE "UserPreset" ALTER COLUMN "value" TYPE VARCHAR(500);
ALTER TABLE "UserPreference" ALTER COLUMN "key" TYPE VARCHAR(255);
ALTER TABLE "UserPreference" ALTER COLUMN "value" TYPE VARCHAR(5000);
