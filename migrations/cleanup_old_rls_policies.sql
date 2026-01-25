-- CLEANUP: Remove all old conflicting RLS policies

-- Drop all old policies that might conflict with the new ones
DROP POLICY IF EXISTS "Authenticated users can view activity log" ON activity_log;
DROP POLICY IF EXISTS "System can create activity logs" ON activity_log;

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles can be created" ON profiles;
DROP POLICY IF EXISTS "System can create profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

DROP POLICY IF EXISTS "Admins can delete any project" ON projects;
DROP POLICY IF EXISTS "Admins can update any project" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;

DROP POLICY IF EXISTS "Authenticated users can view workspaces" ON workspaces;
DROP POLICY IF EXISTS "System can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owner can update" ON workspaces;
DROP POLICY IF EXISTS "Workspace owner can update workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspaces can be created" ON workspaces;

-- Verify remaining policies (should only be the new ones)
SELECT '=== Remaining RLS Policies ===' as status;
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'workspaces', 'projects', 'notifications', 'activity_log')
ORDER BY tablename, policyname;
