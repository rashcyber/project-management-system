-- Migration: Fix super admin access when workspace_id is NULL
-- Issue: Super admins with workspace_id = NULL cannot see projects/profiles due to RLS
-- Solution: Update RLS policies to allow workspace-based super_admins to see all workspace data

-- STEP 1: Update profiles SELECT policy to allow super_admins with NULL workspace to see all profiles
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;

CREATE POLICY "Users can view profiles in their workspace"
  ON profiles FOR SELECT
  USING (
    -- Users can see their own profile
    auth.uid() = id
    OR
    -- Users can see profiles in the same workspace
    (
      workspace_id IN (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
    OR
    -- Super admins with a workspace can see all profiles in their workspace
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id = profiles.workspace_id
      )
    )
    OR
    -- Super admins with NULL workspace can see all profiles (platform admins)
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- STEP 2: Update projects SELECT policy to allow super_admins with NULL workspace
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;

CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Super admins with NULL workspace can see all projects (platform admins)
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- STEP 3: Update tasks SELECT policy to allow super_admins with NULL workspace
DROP POLICY IF EXISTS "Users can view tasks in their workspace" ON tasks;

CREATE POLICY "Users can view tasks in their workspace"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
    OR
    -- Super admins with NULL workspace can see all tasks (platform admins)
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- STEP 4: Update workspaces SELECT policy to include super_admins
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;

CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Super admins with NULL workspace can see all workspaces (platform admins)
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- STEP 5: Verify super admin account exists and is properly configured
-- Check if super_admin account needs workspace assignment
UPDATE profiles
SET workspace_id = NULL
WHERE role = 'super_admin' AND workspace_id IS NULL;

COMMENT ON MIGRATION 'fix-super-admin-workspace-access' IS
'Allows super_admin users with workspace_id = NULL to access all platform data via updated RLS policies';
