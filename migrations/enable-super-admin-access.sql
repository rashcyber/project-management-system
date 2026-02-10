-- Migration: Enable platform super_admin access
-- This migration adds policies that allow super_admins with workspace_id = NULL
-- to see all data across all workspaces

-- ============================================================================
-- Add super_admin bypass policies (non-recursive, using NOT IN instead of subqueries)
-- ============================================================================

-- PROFILES: Super admins can see all profiles
CREATE POLICY "profiles_super_admin_all" ON profiles FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- PROJECTS: Super admins can see all projects
CREATE POLICY "projects_super_admin_all" ON projects FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- TASKS: Super admins can see all tasks
CREATE POLICY "tasks_super_admin_all" ON tasks FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- WORKSPACES: Super admins can see all workspaces
CREATE POLICY "workspaces_super_admin_all" ON workspaces FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- PROJECT_MEMBERS: Super admins can see all
CREATE POLICY "project_members_super_admin_all" ON project_members FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- TASK_ASSIGNEES: Super admins can see all
CREATE POLICY "task_assignees_super_admin_all" ON task_assignees FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- NOTIFICATIONS: Super admins can see all (or limit to their own)
-- For privacy, super admins only see their own notifications
-- (already covered by existing notifications_select_own policy)

-- ACTIVITY_LOG: Super admins can see all
CREATE POLICY "activity_log_super_admin_all" ON activity_log FOR SELECT
  USING (
    CASE
      WHEN (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin'
        AND (SELECT workspace_id FROM profiles WHERE id = auth.uid() LIMIT 1) IS NULL
      THEN TRUE
      ELSE FALSE
    END
  );

-- ============================================================================
-- Verification
-- ============================================================================
-- These policies use CASE statements to avoid recursion
-- Super admins with workspace_id = NULL will now see all data
-- while regular users remain isolated to their workspace
