-- Migration: Restore super admin account access and fix RLS policies
-- This migration restores access for users who have role = 'super_admin' but workspace_id = NULL

-- STEP 1: Find and restore super_admin accounts to their proper role
-- This ensures they maintain full platform access
UPDATE profiles
SET role = 'super_admin'
WHERE id IN (
  SELECT id FROM profiles
  WHERE workspace_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1
);

-- STEP 2: Comprehensive RLS policy fixes to ensure super_admins with NULL workspace can access everything

-- Fix profiles policy
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;

CREATE POLICY "Users can view profiles in their workspace"
  ON profiles FOR SELECT
  USING (
    -- Own profile
    auth.uid() = id
    OR
    -- Same workspace members
    workspace_id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Workspace-based super admins
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
        AND p.workspace_id = profiles.workspace_id
      )
    )
    OR
    -- Platform super admins (NULL workspace)
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
        AND p.workspace_id IS NULL
      )
    )
  );

-- Fix projects policy
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;

CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Platform super admins can see all projects
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- Fix tasks policy
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
    -- Platform super admins can see all tasks
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- Fix workspaces policy
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;

CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Platform super admins can see all workspaces
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- STEP 3: Verify the restoration
-- This query shows your super admin account status
SELECT
  id,
  email,
  role,
  workspace_id,
  created_at
FROM profiles
WHERE role = 'super_admin'
LIMIT 5;
