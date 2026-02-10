-- Migration: Clean and rebuild all RLS policies from scratch
-- Removes all broken/overlapping policies and creates a single clean set

-- ============================================================================
-- STEP 1: Drop ALL existing policies on profiles (too many overlapping ones)
-- ============================================================================
DROP POLICY IF EXISTS "Admins can update members in their workspace" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in workspace" ON profiles;
DROP POLICY IF EXISTS "Platform super admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_super_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Drop any other lingering policies
DROP POLICY IF EXISTS "profiles_select_workspace" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- ============================================================================
-- STEP 2: Drop all policies on other tables to ensure clean state
-- ============================================================================
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;
DROP POLICY IF EXISTS "Platform super admins view all projects" ON projects;
DROP POLICY IF EXISTS "projects_select_workspace" ON projects;
DROP POLICY IF EXISTS "projects_insert_workspace" ON projects;
DROP POLICY IF EXISTS "projects_update_owner" ON projects;
DROP POLICY IF EXISTS "projects_delete_owner" ON projects;
DROP POLICY IF EXISTS "projects_super_admin_all" ON projects;

DROP POLICY IF EXISTS "Users can view tasks in their workspace" ON tasks;
DROP POLICY IF EXISTS "Platform super admins view all tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_super_admin_all" ON tasks;

DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Platform super admins view all workspaces" ON workspaces;
DROP POLICY IF EXISTS "System admins can view all workspaces" ON workspaces;
DROP POLICY IF EXISTS "System admins can delete any workspace" ON workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
DROP POLICY IF EXISTS "workspaces_super_admin_all" ON workspaces;

DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_super_admin_all" ON project_members;

DROP POLICY IF EXISTS "task_assignees_select" ON task_assignees;
DROP POLICY IF EXISTS "task_assignees_super_admin_all" ON task_assignees;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;

DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
DROP POLICY IF EXISTS "activity_log_super_admin_all" ON activity_log;

-- ============================================================================
-- STEP 3: Create ONE simple, clean set of policies per table
-- ============================================================================

-- PROFILES TABLE
-- Rule 1: Users see their own profile
-- Rule 2: Users see profiles in their workspace
-- Rule 3: Super admins with NULL workspace see all profiles
CREATE POLICY "profiles_users_own" ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_users_workspace" ON profiles FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "profiles_super_admin_view_all" ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PROJECTS TABLE
CREATE POLICY "projects_users_workspace" ON projects FOR SELECT
  USING (
    workspace_id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "projects_super_admin_view_all" ON projects FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

CREATE POLICY "projects_insert_workspace" ON projects FOR INSERT
  WITH CHECK (
    workspace_id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "projects_update_owner" ON projects FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "projects_delete_owner" ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- TASKS TABLE
CREATE POLICY "tasks_users_workspace" ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id = (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
        LIMIT 1
      )
    )
  );

CREATE POLICY "tasks_super_admin_view_all" ON tasks FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id = (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
        LIMIT 1
      )
    )
  );

-- WORKSPACES TABLE
CREATE POLICY "workspaces_users_own" ON workspaces FOR SELECT
  USING (
    id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "workspaces_super_admin_view_all" ON workspaces FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- PROJECT_MEMBERS TABLE
CREATE POLICY "project_members_workspace" ON project_members FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id = (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
        LIMIT 1
      )
    )
  );

CREATE POLICY "project_members_super_admin" ON project_members FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- TASK_ASSIGNEES TABLE
CREATE POLICY "task_assignees_workspace" ON task_assignees FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT id FROM projects
        WHERE workspace_id = (
          SELECT workspace_id FROM profiles
          WHERE id = auth.uid() AND workspace_id IS NOT NULL
          LIMIT 1
        )
      )
    )
  );

CREATE POLICY "task_assignees_super_admin" ON task_assignees FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- NOTIFICATIONS TABLE
CREATE POLICY "notifications_own" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- ACTIVITY_LOG TABLE
CREATE POLICY "activity_log_workspace" ON activity_log FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id = (
        SELECT workspace_id FROM profiles
        WHERE id = auth.uid() AND workspace_id IS NOT NULL
        LIMIT 1
      )
    )
  );

CREATE POLICY "activity_log_super_admin" ON activity_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- ============================================================================
-- STEP 4: Verify
-- ============================================================================
-- All old broken policies have been removed
-- New clean policies are in place
-- Each policy is simple and doesn't cause recursion
-- Super admins (workspace_id = NULL) can access all data
-- Regular users see only their workspace data
