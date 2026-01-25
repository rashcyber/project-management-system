-- CHECK ALL RLS POLICIES AND THEIR DEFINITIONS

SELECT '=== ALL RLS POLICIES ===' as step;
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
ORDER BY tablename, policyname;

SELECT '=== RECORD COUNTS ===' as step;
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'workspaces', COUNT(*) FROM workspaces;

SELECT '=== PROFILES WITH NULL WORKSPACE ===' as step;
SELECT COUNT(*) FROM profiles WHERE workspace_id IS NULL;

SELECT '=== PROJECTS WITH NULL WORKSPACE ===' as step;
SELECT COUNT(*) FROM projects WHERE workspace_id IS NULL;

SELECT '=== TEST: Can I query profiles? ===' as step;
SELECT id, email, role FROM profiles LIMIT 5;

SELECT '=== TEST: Can I query projects? ===' as step;
SELECT id, name, workspace_id FROM projects LIMIT 5;
