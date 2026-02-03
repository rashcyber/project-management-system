-- Migration: Fix critical workspace isolation in RLS policies
-- Issue: Users from different workspaces could see each other's data
-- Root Cause: RLS policies don't check workspace_id, allowing cross-workspace data access

-- ===== STEP 1: Fix PROFILES table policies =====
-- Drop the overly permissive policy that allowed everyone to see all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create a proper workspace-isolated SELECT policy for profiles
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
    -- Super admins can see all profiles in their workspace
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id = profiles.workspace_id
      )
    )
  );

-- Replace the update policy to respect workspace isolation
DROP POLICY IF EXISTS "Super admins and admins can update any profile" ON profiles;

CREATE POLICY "Super admins and admins can update profiles in their workspace"
  ON profiles FOR UPDATE
  USING (
    -- Users can update their own profile
    auth.uid() = id
    OR
    -- Super admins can update users in their workspace
    (
      EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
        AND admin.role = 'super_admin'
        AND admin.workspace_id = profiles.workspace_id
      )
    )
    OR
    -- Admins can update members in their workspace
    (
      EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
        AND admin.role = 'admin'
        AND admin.workspace_id = profiles.workspace_id
        AND profiles.role IN ('member', 'manager')
      )
    )
  )
  WITH CHECK (
    -- Can't promote to super_admin
    role != 'super_admin' OR auth.uid() = id
  );

-- ===== STEP 2: Fix PROJECTS table policies =====
-- Drop old policies that don't check workspace
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
DROP POLICY IF EXISTS "Admins and managers can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON projects;
DROP POLICY IF EXISTS "Project owners and admins can delete projects" ON projects;

-- Create workspace-aware project SELECT policy
CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    -- Must be in the same workspace as the project
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
  );

-- Create workspace-aware project INSERT policy
CREATE POLICY "Users can create projects in their workspace"
  ON projects FOR INSERT WITH CHECK (
    -- Project owner must be in the same workspace
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND workspace_id = projects.workspace_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Create workspace-aware project UPDATE policy
CREATE POLICY "Project owners and admins can update projects"
  ON projects FOR UPDATE
  USING (
    -- Only admins and owners in same workspace
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND workspace_id = projects.workspace_id
    )
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    )
  );

-- Create workspace-aware project DELETE policy
CREATE POLICY "Project owners and admins can delete projects"
  ON projects FOR DELETE
  USING (
    -- Only admins and owners in same workspace
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND workspace_id = projects.workspace_id
    )
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    )
  );

-- ===== STEP 3: Fix PROJECT_MEMBERS table policies =====
-- Drop old policies
DROP POLICY IF EXISTS "Users can view project members of their projects" ON project_members;
DROP POLICY IF EXISTS "Admins can manage project members" ON project_members;

-- Create workspace-aware project members policies
CREATE POLICY "Users can view project members in their workspace"
  ON project_members FOR SELECT
  USING (
    -- User must be in same workspace as the project
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
      AND p.workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
  );

CREATE POLICY "Admins can manage project members in their workspace"
  ON project_members FOR ALL
  USING (
    -- Project must be in user's workspace
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
      AND p.workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
    AND
    -- User must be admin or project owner
    (
      EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    )
  );

-- Comment for documentation
COMMENT ON POLICY "Users can view profiles in their workspace" ON profiles
  IS 'Ensures users can only see profiles in their own workspace, preventing cross-workspace data leakage';

COMMENT ON POLICY "Super admins and admins can update profiles in their workspace" ON profiles
  IS 'Ensures workspace isolation in updates - super_admins can only manage their workspace, cannot be escalated';

COMMENT ON POLICY "Users can view projects in their workspace" ON projects
  IS 'Users can only see projects in their own workspace - enforces workspace isolation';

COMMENT ON POLICY "Users can create projects in their workspace" ON projects
  IS 'Projects can only be created within user workspace by authorized roles';

COMMENT ON POLICY "Users can view project members in their workspace" ON project_members
  IS 'Project members can only be viewed if project is in user workspace';
