-- COMPREHENSIVE RLS FIX
-- This fixes all RLS policy issues that broke profile fetching

-- STEP 1: DISABLE RLS TEMPORARILY TO FIX DATA
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- STEP 2: VERIFY AND FIX USER DATA
SELECT '=== DATA VERIFICATION ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles;

-- Ensure Salia Abdul Rashid is super_admin
UPDATE profiles SET role = 'super_admin' WHERE email = 'rashidsalia057@gmail.com';

-- STEP 3: FIX WORKSPACE ASSIGNMENTS
-- Create workspace for super_admin if they don't have one
DO $$
DECLARE
  user_id UUID;
  user_workspace_id UUID;
  new_workspace_id UUID;
BEGIN
  SELECT id INTO user_id FROM profiles WHERE email = 'rashidsalia057@gmail.com' LIMIT 1;

  IF user_id IS NOT NULL THEN
    SELECT profiles.workspace_id INTO user_workspace_id FROM profiles WHERE profiles.id = user_id;

    IF user_workspace_id IS NULL THEN
      INSERT INTO workspaces (name, owner_id)
      VALUES ('Salia''s Workspace', user_id)
      RETURNING id INTO new_workspace_id;

      UPDATE profiles SET workspace_id = new_workspace_id WHERE id = user_id;
    END IF;
  END IF;
END $$;

-- Assign all users without workspace to the first workspace
DO $$
DECLARE
  default_workspace_id UUID;
BEGIN
  SELECT id INTO default_workspace_id FROM workspaces ORDER BY created_at ASC LIMIT 1;

  IF default_workspace_id IS NOT NULL THEN
    UPDATE profiles
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL;
  END IF;
END $$;

-- STEP 4: ASSIGN PROJECTS TO WORKSPACES
UPDATE projects p
SET workspace_id = pr.workspace_id
FROM profiles pr
WHERE p.owner_id = pr.id AND p.workspace_id IS NULL;

-- STEP 5: VERIFY FINAL DATA STATE
SELECT '=== FINAL DATA STATE ===' as step;
SELECT 'Users:' as check_type;
SELECT id, email, full_name, role, workspace_id FROM profiles;

SELECT '' as separator;
SELECT 'Workspaces:' as check_type;
SELECT id, name, owner_id FROM workspaces;

SELECT '' as separator;
SELECT 'Projects with workspaces:' as check_type;
SELECT id, name, owner_id, workspace_id FROM projects LIMIT 10;

-- STEP 6: DROP ALL EXISTING RLS POLICIES
DROP POLICY IF EXISTS "Users can view themselves" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in workspace" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;
DROP POLICY IF EXISTS "Users can view their workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can view profiles in same workspace" ON profiles;
DROP POLICY IF EXISTS "Users can access projects in same workspace" ON projects;

-- STEP 7: RE-ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- STEP 8: CREATE SIMPLE AND WORKING RLS POLICIES

-- ===== PROFILES TABLE POLICIES =====
-- Allow users to view their own profile (most important)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow admins to view all profiles in their workspace
CREATE POLICY "Admins can view workspace profiles"
  ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
    AND workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ===== WORKSPACES TABLE POLICIES =====
-- Allow workspace owner to view their workspace
CREATE POLICY "Workspace owner can view workspace"
  ON workspaces FOR SELECT
  USING (owner_id = auth.uid());

-- Allow workspace members to view workspace
CREATE POLICY "Workspace members can view workspace"
  ON workspaces FOR SELECT
  USING (
    id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
  );

-- ===== PROJECTS TABLE POLICIES =====
-- Allow users to view projects in their workspace
CREATE POLICY "Users can view workspace projects"
  ON projects FOR SELECT
  USING (
    workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
  );

-- Allow project owner to view their projects
CREATE POLICY "Project owner can view project"
  ON projects FOR SELECT
  USING (owner_id = auth.uid());

-- Allow users to create projects in their workspace
CREATE POLICY "Users can create projects in workspace"
  ON projects FOR INSERT
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
  );

-- Allow project owners to update their projects
CREATE POLICY "Project owner can update project"
  ON projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Allow project owners to delete their projects
CREATE POLICY "Project owner can delete project"
  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- ===== NOTIFICATIONS TABLE POLICIES =====
-- Allow users to view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Allow admins to view workspace notifications (optional)
CREATE POLICY "Admins can view workspace notifications"
  ON notifications FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
    AND user_id IN (
      SELECT id FROM profiles
      WHERE workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
    )
  );

-- STEP 9: FINAL VERIFICATION
SELECT '=== RLS POLICIES CREATED ===' as step;
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE tablename IN ('profiles', 'workspaces', 'projects', 'notifications')
ORDER BY tablename, policyname;

SELECT '=== TEST: Can fetch own profile ===' as test;
SELECT id, email, full_name, role, workspace_id FROM profiles WHERE id = auth.uid();
