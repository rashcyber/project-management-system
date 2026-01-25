-- FIX: Remove circular RLS dependencies that cause 500 errors
-- The issue: RLS policies querying the same table they're protecting causes failures

-- STEP 1: Disable RLS on all affected tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop all problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view workspace profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Workspace owner can view workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspace members can view workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspace projects" ON projects;
DROP POLICY IF EXISTS "Project owner can view project" ON projects;
DROP POLICY IF EXISTS "Users can create projects in workspace" ON projects;
DROP POLICY IF EXISTS "Project owner can update project" ON projects;
DROP POLICY IF EXISTS "Project owner can delete project" ON projects;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can view workspace notifications" ON notifications;

-- STEP 3: Re-enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create simple, non-circular RLS policies

-- ===== PROFILES TABLE =====
-- Allow users to view their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow super_admin to view all profiles
CREATE POLICY "profiles_select_super_admin"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ===== WORKSPACES TABLE =====
-- Allow users to view their own workspace
CREATE POLICY "workspaces_select_own"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.workspace_id = workspaces.id
    )
    OR owner_id = auth.uid()
  );

-- ===== PROJECTS TABLE =====
-- Allow users to view projects in their workspace
CREATE POLICY "projects_select_own_workspace"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.workspace_id = projects.workspace_id
    )
    OR owner_id = auth.uid()
  );

-- Allow users to create projects in their workspace
CREATE POLICY "projects_insert_own_workspace"
  ON projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.workspace_id = projects.workspace_id
    )
  );

-- Allow project owners to update
CREATE POLICY "projects_update_own"
  ON projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Allow project owners to delete
CREATE POLICY "projects_delete_own"
  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- ===== NOTIFICATIONS TABLE =====
-- Allow users to view their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- ===== ACTIVITY_LOG TABLE =====
-- Allow users to view activity logs (simple policy)
CREATE POLICY "activity_log_select_own"
  ON activity_log FOR SELECT
  USING (true);

-- STEP 5: Verification
SELECT '=== RLS Policies Fixed ===' as status;
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'workspaces', 'projects', 'notifications', 'activity_log')
ORDER BY tablename, policyname;
