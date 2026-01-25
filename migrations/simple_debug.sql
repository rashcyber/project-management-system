-- SIMPLE DEBUG QUERIES TO FIND 500 ERROR ROOT CAUSE

SELECT '=== STEP 1: Check RLS Policies ===' as diagnostic;
SELECT tablename, policyname, permissive FROM pg_policies
WHERE tablename IN ('profiles', 'projects', 'workspaces');

SELECT '=== STEP 2: Count records in each table ===' as diagnostic;
SELECT 'profiles' as table_name, COUNT(*) as record_count FROM profiles
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'workspaces', COUNT(*) FROM workspaces
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;

SELECT '=== STEP 3: Check for NULL workspace_id (profiles) ===' as diagnostic;
SELECT COUNT(*) as null_workspace_count FROM profiles WHERE workspace_id IS NULL;

SELECT '=== STEP 4: Check for NULL workspace_id (projects) ===' as diagnostic;
SELECT COUNT(*) as null_workspace_count FROM projects WHERE workspace_id IS NULL;

SELECT '=== STEP 5: Simple profile query ===' as diagnostic;
SELECT id, email FROM profiles LIMIT 1;

SELECT '=== STEP 6: Profile with role ===' as diagnostic;
SELECT id, email, role FROM profiles LIMIT 1;

SELECT '=== STEP 7: Profile with workspace ===' as diagnostic;
SELECT id, email, workspace_id FROM profiles LIMIT 1;

SELECT '=== STEP 8: Projects query ===' as diagnostic;
SELECT id, name FROM projects LIMIT 1;

SELECT '=== STEP 9: Check for broken foreign keys (profiles) ===' as diagnostic;
SELECT COUNT(*) as broken_refs FROM profiles
WHERE workspace_id IS NOT NULL
AND workspace_id NOT IN (SELECT id FROM workspaces);

SELECT '=== STEP 10: Check for broken foreign keys (projects) ===' as diagnostic;
SELECT COUNT(*) as broken_refs FROM projects
WHERE workspace_id IS NOT NULL
AND workspace_id NOT IN (SELECT id FROM workspaces);

SELECT '=== STEP 11: List all policies on profiles ===' as diagnostic;
SELECT policyname, qual FROM pg_policies WHERE tablename = 'profiles';

SELECT '=== STEP 12: List all policies on projects ===' as diagnostic;
SELECT policyname, qual FROM pg_policies WHERE tablename = 'projects';

SELECT '=== STEP 13: Profiles table structure ===' as diagnostic;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

SELECT '=== STEP 14: Projects table structure ===' as diagnostic;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
