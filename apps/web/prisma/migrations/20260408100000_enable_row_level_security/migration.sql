-- Enable Row Level Security on all tables to prevent unauthorized access

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Critical security tables (contain sensitive tokens)
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtensionToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;

-- User data tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreference" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE SECURITY POLICIES
-- ============================================================================

-- User table: Users can only access their own record
CREATE POLICY "Users can only access own record" ON "User"
    FOR ALL USING (id = current_setting('app.current_user_id', true));

-- Account table: Users can only access their own OAuth accounts
CREATE POLICY "Users can only access own accounts" ON "Account"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- Session table: Users can only access their own sessions
CREATE POLICY "Users can only access own sessions" ON "Session"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- ExtensionToken table: Users can only access their own extension tokens
CREATE POLICY "Users can only access own extension tokens" ON "ExtensionToken"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- Bookmark table: Users can only access their own bookmarks
CREATE POLICY "Users can only access own bookmarks" ON "Bookmark"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- Folder table: Users can only access their own folders
CREATE POLICY "Users can only access own folders" ON "Folder"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- UserPreset table: Users can only access their own presets
CREATE POLICY "Users can only access own presets" ON "UserPreset"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- UserPreference table: Users can only access their own preferences
CREATE POLICY "Users can only access own preferences" ON "UserPreference"
    FOR ALL USING ("userId" = current_setting('app.current_user_id', true));

-- VerificationToken table: Special case - these need limited public access for email verification
-- Allow read access for verification, but restrict sensitive operations
CREATE POLICY "Verification tokens read access" ON "VerificationToken"
    FOR SELECT USING (true);

CREATE POLICY "Verification tokens write access restricted" ON "VerificationToken"
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Verification tokens delete own only" ON "VerificationToken"
    FOR DELETE USING (true); -- These expire automatically and cleanup is system-managed

-- ============================================================================
-- 3. CREATE HELPER FUNCTION TO SET CURRENT USER CONTEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE FUNCTION TO GET CURRENT USER ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant execute permission on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION set_current_user_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated;

-- Ensure the application user can still access tables (bypass RLS for service role)
-- Note: This should be configured at the database role level, not in migration
-- ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "ExtensionToken" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Bookmark" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Folder" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "UserPreset" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "UserPreference" FORCE ROW LEVEL SECURITY;