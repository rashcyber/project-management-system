-- CRITICAL: Debug 500 errors in Supabase

-- STEP 1: Check if RLS is causing infinite loops or errors
SELECT '=== CHECKING RLS POLICIES ===' as step;
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('profiles', 'projects', 'workspaces', 'notifications')
ORDER BY tablename, policyname;

-- STEP 2: Test each table individually (RLS disabled context)
SELECT '=== TEST 1: Can read profiles (with RLS) ===' as test;
SELECT COUNT(*) as profile_count FROM profiles;

SELECT '=== TEST 2: Can read projects (with RLS) ===' as test;
SELECT COUNT(*) as project_count FROM projects;

SELECT '=== TEST 3: Can read workspaces (with RLS) ===' as test;
SELECT COUNT(*) as workspace_count FROM workspaces;

-- STEP 3: Check for NULL constraint violations that might cause errors
SELECT '=== CHECK 1: Profiles with NULL workspace_id ===' as check_type;
SELECT COUNT(*) as null_workspace_count FROM profiles WHERE workspace_id IS NULL;

SELECT '=== CHECK 2: Projects with NULL workspace_id ===' as check_type;
SELECT COUNT(*) as null_workspace_count FROM projects WHERE workspace_id IS NULL;

SELECT '=== CHECK 3: Profiles table structure ===' as check_type;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- STEP 4: Check foreign key constraints
SELECT '=== FOREIGN KEYS ===' as check_type;
SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.table_name = kcu.table_name AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('profiles', 'projects', 'workspaces')
ORDER BY tc.table_name, tc.constraint_name;

-- STEP 5: Check for problematic RLS policies that might be causing recursion
SELECT '=== CHECK RLS POLICY DEFINITIONS ===' as check_type;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  (CASE WHEN qual LIKE '%SELECT%' THEN 'HAS SELECT' ELSE 'NO SELECT' END) as qual_has_select,
  (CASE WHEN qual LIKE '%FROM%profiles%' THEN 'REFERENCES PROFILES' ELSE 'OK' END) as potential_recursion
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- STEP 6: Test specific failing queries
SELECT '=== TEST QUERY 1: Simple profile select ===' as test;
SELECT id, email, full_name, role FROM profiles LIMIT 1;

SELECT '=== TEST QUERY 2: Profile with workspace ===' as test;
SELECT id, email, full_name, role, workspace_id FROM profiles LIMIT 1;

SELECT '=== TEST QUERY 3: Projects with owner ===' as test;
SELECT id, name, owner_id, workspace_id FROM projects LIMIT 1;

-- STEP 7: Check if joins are the problem
SELECT '=== TEST QUERY 4: Project with owner profile join ===' as test;
SELECT p.id, p.name, pr.id as owner_id, pr.full_name as owner_name
FROM projects p
LEFT JOIN profiles pr ON p.owner_id = pr.id
LIMIT 1;

-- STEP 8: Check table sizes and potential issues
SELECT '=== TABLE STATS ===' as check_type;
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'projects', 'workspaces', 'notifications', 'tasks')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- STEP 9: Check for invalid foreign key references
SELECT '=== CHECK INVALID FOREIGN KEYS ===' as check_type;
SELECT 'Profiles with non-existent workspace' as issue;
SELECT COUNT(*) as count
FROM profiles p
WHERE workspace_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = p.workspace_id);

SELECT 'Projects with non-existent workspace' as issue;
SELECT COUNT(*) as count
FROM projects p
WHERE workspace_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = p.workspace_id);

-- STEP 10: Verify triggers
SELECT '=== TRIGGERS ===' as check_type;
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
