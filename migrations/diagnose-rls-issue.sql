-- Diagnostic migration to identify RLS policy issues
-- This will disable RLS temporarily to see if data exists

-- STEP 1: Check your super_admin account
SELECT
  'Super Admin Accounts' as check_type,
  COUNT(*) as count,
  STRING_AGG(email, ', ') as emails
FROM profiles
WHERE role = 'super_admin';

-- STEP 2: Check if projects exist
SELECT
  'Total Projects' as check_type,
  COUNT(*) as count
FROM projects;

-- STEP 3: Check workspaces
SELECT
  'Workspaces' as check_type,
  COUNT(*) as count
FROM workspaces;

-- STEP 4: Check project members
SELECT
  'Project Members' as check_type,
  COUNT(*) as count
FROM project_members;

-- STEP 5: Check all RLS policies on projects table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'projects'
ORDER BY policyname;

-- STEP 6: Check all RLS policies on profiles table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- STEP 7: Disable RLS on projects table to test (TEMPORARY - for debugging only)
-- This will allow us to see if data exists
-- ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- STEP 8: After you run the SELECT queries above, check the results
-- Then run these ALTER commands if needed:
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- NOTE: Do NOT keep RLS disabled in production. Only use for testing.
-- After testing, re-enable with:
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
