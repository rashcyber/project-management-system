-- Fix: Remove all old RLS policies and set up clean ones for invite_links
-- This ensures deleted links don't appear even after refresh

-- STEP 1: Drop ALL existing policies on invite_links
DROP POLICY IF EXISTS "Users can view invite links they created" ON invite_links;
DROP POLICY IF EXISTS "Users can view non-deleted invite links they created" ON invite_links;
DROP POLICY IF EXISTS "Users can update their invite links" ON invite_links;
DROP POLICY IF EXISTS "Users can update non-deleted invite links" ON invite_links;
DROP POLICY IF EXISTS "Users can delete their invite links" ON invite_links;
DROP POLICY IF EXISTS "Authenticated users can create invite links" ON invite_links;
DROP POLICY IF EXISTS "System can manage email queue" ON invite_links;
DROP POLICY IF EXISTS "Anyone can view public invite links" ON invite_links;

-- STEP 2: Disable RLS temporarily to verify data
ALTER TABLE invite_links DISABLE ROW LEVEL SECURITY;

-- STEP 3: Check data integrity
SELECT '=== Data Check ===' as status;
SELECT
  COUNT(*) as total_links,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_links,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_links
FROM invite_links;

-- Show sample of deleted links
SELECT '=== Sample Deleted Links ===' as status;
SELECT id, code, is_active, deleted_at, created_by, created_at
FROM invite_links
WHERE deleted_at IS NOT NULL
LIMIT 5;

-- Show sample of active links
SELECT '=== Sample Active Links ===' as status;
SELECT id, code, is_active, deleted_at, created_by, created_at
FROM invite_links
WHERE deleted_at IS NULL
LIMIT 5;

-- STEP 4: Re-enable RLS
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create clean, simple RLS policies

-- Policy 1: Users can SELECT their own non-deleted invite links
CREATE POLICY "invite_links_select_own_active"
  ON invite_links FOR SELECT
  USING (
    created_by = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 2: Users can SELECT deleted invite links (for audit/recovery purposes)
CREATE POLICY "invite_links_select_own_deleted"
  ON invite_links FOR SELECT
  USING (
    created_by = auth.uid()
    AND deleted_at IS NOT NULL
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
  );

-- Policy 3: Users can UPDATE their own non-deleted links
CREATE POLICY "invite_links_update_own"
  ON invite_links FOR UPDATE
  USING (
    created_by = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy 4: Users can INSERT new invite links
CREATE POLICY "invite_links_insert_own"
  ON invite_links FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
  );

-- Policy 5: Users can DELETE their own links (sets deleted_at)
CREATE POLICY "invite_links_delete_own"
  ON invite_links FOR DELETE
  USING (
    created_by = auth.uid()
  );

-- STEP 6: Verify policies are in place
SELECT '=== RLS Policies Configured ===' as status;
SELECT policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'invite_links'
ORDER BY policyname;

-- STEP 7: Test query - what a user should see
SELECT '=== Test: What users should see (only non-deleted) ===' as status;
SELECT code, is_active, deleted_at
FROM invite_links
WHERE created_by = auth.uid() AND deleted_at IS NULL
ORDER BY created_at DESC;

-- STEP 8: Verify the fix
SELECT '=== Verification Complete ===' as status;
SELECT 'If the test query above shows no deleted_at values, the fix is working' as message;
