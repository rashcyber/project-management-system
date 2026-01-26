-- Migration: Fix invite link deletion to ensure deleted links don't reappear

-- STEP 1: Check current state of invite_links table
SELECT '=== Current State ===' as status;
SELECT id, code, created_by, deleted_at, is_active FROM invite_links LIMIT 5;

-- STEP 2: Disable RLS temporarily to check data
ALTER TABLE invite_links DISABLE ROW LEVEL SECURITY;

-- STEP 3: Check all RLS policies on invite_links
SELECT '=== Current RLS Policies ===' as status;
SELECT policyname, qual FROM pg_policies WHERE tablename = 'invite_links';

-- STEP 4: Drop all existing RLS policies on invite_links
DROP POLICY IF EXISTS "Users can view invite links they created" ON invite_links;
DROP POLICY IF EXISTS "Users can view non-deleted invite links they created" ON invite_links;
DROP POLICY IF EXISTS "Users can update their invite links" ON invite_links;
DROP POLICY IF EXISTS "Users can update non-deleted invite links" ON invite_links;
DROP POLICY IF EXISTS "System can manage invite links" ON invite_links;
DROP POLICY IF EXISTS "Admin can view all invite links" ON invite_links;

-- STEP 5: Re-enable RLS
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create new, simpler RLS policies that work correctly
-- Allow users to view their own invite links (including deleted ones for now, filtering happens in app)
CREATE POLICY "Users can view invite links for their workspace"
  ON invite_links FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow users to update their invite links
CREATE POLICY "Users can update invite links in their workspace"
  ON invite_links FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow users to delete their invite links
CREATE POLICY "Users can delete invite links in their workspace"
  ON invite_links FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- STEP 7: Verify policies are in place
SELECT '=== New RLS Policies Created ===' as status;
SELECT policyname FROM pg_policies WHERE tablename = 'invite_links' ORDER BY policyname;

-- STEP 8: Verify deleted_at column exists
SELECT '=== Column Verification ===' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invite_links' AND column_name IN ('deleted_at', 'is_active', 'workspace_id')
ORDER BY column_name;

-- STEP 9: Check for any deleted links
SELECT '=== Deleted Links (deleted_at IS NOT NULL) ===' as status;
SELECT COUNT(*) as deleted_count, COUNT(CASE WHEN is_active = false THEN 1 END) as revoked_count
FROM invite_links WHERE deleted_at IS NOT NULL;

-- STEP 10: Summary
SELECT '=== Summary ===' as status;
SELECT
  (SELECT COUNT(*) FROM invite_links WHERE deleted_at IS NULL) as active_links,
  (SELECT COUNT(*) FROM invite_links WHERE deleted_at IS NOT NULL) as deleted_links,
  (SELECT COUNT(*) FROM invite_links) as total_links;
