-- Migration: Fix RLS policies to allow platform super_admins (workspace_id = NULL) full access
-- Issue: Super admins with workspace_id = NULL cannot access projects/profiles/workspaces
-- Solution: Update all relevant RLS policies to explicitly allow platform super_admins

-- ============================================================================
-- STEP 1: Fix PROFILES table SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;

CREATE POLICY "Users can view profiles in their workspace"
  ON profiles FOR SELECT
  USING (
    -- Own profile
    auth.uid() = id
    OR
    -- Users in the same workspace
    (
      workspace_id IS NOT NULL
      AND workspace_id IN (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
    OR
    -- Workspace-based super_admins viewing their workspace members
    (
      EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
        AND admin.role = 'super_admin'
        AND admin.workspace_id IS NOT NULL
        AND admin.workspace_id = profiles.workspace_id
      )
    )
    OR
    -- Platform super_admins (workspace_id = NULL) can view all profiles
    (
      EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
        AND admin.role = 'super_admin'
        AND admin.workspace_id IS NULL
      )
    )
  );

-- ============================================================================
-- STEP 2: Fix PROJECTS table SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;

CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    -- Users in projects' workspace
    workspace_id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Platform super_admins (workspace_id = NULL) can view all projects
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- ============================================================================
-- STEP 3: Fix TASKS table SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view tasks in their workspace" ON tasks;

CREATE POLICY "Users can view tasks in their workspace"
  ON tasks FOR SELECT
  USING (
    -- Tasks in projects where user is a member
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.workspace_id IN (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
    OR
    -- Platform super_admins can view all tasks
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- ============================================================================
-- STEP 4: Fix WORKSPACES table SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;

CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (
    -- User's own workspaces
    id IN (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR
    -- Platform super_admins can view all workspaces
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND workspace_id IS NULL
      )
    )
  );

-- ============================================================================
-- STEP 5: Ensure existing system admin policies work alongside these
-- ============================================================================
-- These policies should already exist from add-system-admin-role.sql
-- but we ensure they're compatible with workspace isolation

-- The "System admins can view all workspaces" policy uses is_system_admin flag
-- which is separate from role = 'super_admin'

-- ============================================================================
-- STEP 6: Verification - Show super admin accounts
-- ============================================================================
-- Run this query to verify your accounts can access data:
-- SELECT id, email, role, workspace_id FROM profiles WHERE role = 'super_admin';
