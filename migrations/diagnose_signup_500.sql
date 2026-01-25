-- Diagnostic script to identify the signup 500 error
-- The signup endpoint is failing when trying to create a profile via trigger

-- STEP 1: Check if the trigger function exists and has SECURITY DEFINER
SELECT '=== TRIGGER FUNCTION CHECK ===' as step;
SELECT proname, prosecdef, prosrc FROM pg_proc WHERE proname = 'handle_new_user';

-- STEP 2: Check if the trigger is attached
SELECT '=== TRIGGER CHECK ===' as step;
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'users';

-- STEP 3: Check RLS is enabled on profiles and workspaces
SELECT '=== RLS STATUS ===' as step;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'workspaces', 'invite_links');

-- STEP 4: List all policies on profiles table
SELECT '=== PROFILES TABLE POLICIES ===' as step;
SELECT policyname, permissive, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles' ORDER BY policyname;

-- STEP 5: Test if we can manually insert a profile (simulating what the trigger does)
-- Note: This will fail if there's a policy issue
SELECT '=== ATTEMPTING TEST INSERT (this may fail if RLS blocks it) ===' as step;
-- Don't actually insert, just show what would happen

-- STEP 6: Check profiles table structure
SELECT '=== PROFILES TABLE STRUCTURE ===' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- STEP 7: Check workspaces table structure
SELECT '=== WORKSPACES TABLE STRUCTURE ===' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'workspaces'
ORDER BY ordinal_position;
