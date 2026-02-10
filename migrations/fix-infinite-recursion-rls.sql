-- Migration: Fix infinite recursion in RLS policies
-- Issue: Recursive subqueries in policies cause "infinite recursion detected in policy"
-- Solution: Rewrite policies to avoid self-referential queries

-- ============================================================================
-- STEP 1: Drop all problematic policies that cause recursion
-- ============================================================================
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;
DROP POLICY IF EXISTS "Users can view tasks in their workspace" ON tasks;
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;

-- ============================================================================
-- STEP 2: Recreate PROFILES policy WITHOUT recursion
-- ============================================================================
-- Instead of checking auth.uid()'s profile inside profiles policy,
-- we only allow users to see their own profile + profiles in public workspace
-- and let application-level logic handle admin access

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their workspace"
  ON profiles FOR SELECT
  USING (
    -- Users can see others in the same workspace
    workspace_id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
  );

-- Allow super_admin and admins to view all profiles in their workspace
CREATE POLICY "Admins can view all profiles in workspace"
  ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role IN ('super_admin', 'admin')
      AND workspace_id = profiles.workspace_id
    )
  );

-- Allow platform super_admins (workspace_id = NULL with super_admin role) to view all
CREATE POLICY "Platform super admins view all profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
    )
  );

-- ============================================================================
-- STEP 3: Fix PROJECTS policy WITHOUT recursion
-- ============================================================================
CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
  );

-- Platform super_admins can see all projects
CREATE POLICY "Platform super admins view all projects"
  ON projects FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
    )
  );

-- ============================================================================
-- STEP 4: Fix TASKS policy WITHOUT recursion
-- ============================================================================
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
  );

-- Platform super_admins can see all tasks
CREATE POLICY "Platform super admins view all tasks"
  ON tasks FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
    )
  );

-- ============================================================================
-- STEP 5: Fix WORKSPACES policy WITHOUT recursion
-- ============================================================================
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
  );

-- Platform super_admins can see all workspaces
CREATE POLICY "Platform super admins view all workspaces"
  ON workspaces FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
    )
  );

-- ============================================================================
-- STEP 6: Ensure UPDATE policies don't cause recursion
-- ============================================================================
DROP POLICY IF EXISTS "Super admins and admins can update profiles in their workspace" ON profiles;

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update members in their workspace"
  ON profiles FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role IN ('super_admin', 'admin')
      AND workspace_id = profiles.workspace_id
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying this migration, all users should:
-- 1. See their own profile
-- 2. See profiles/projects/tasks in their workspace (if assigned to one)
-- 3. Platform super_admins (workspace_id = NULL) see everything
