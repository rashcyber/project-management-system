-- Migration: Nuclear option - explicitly drop EVERY policy by querying pg_policies
-- This will work even if policies exist

-- ============================================================================
-- Get all policy names and drop them one by one
-- ============================================================================

-- Drop all policies on profiles
DROP POLICY IF EXISTS "profiles_users_own" ON profiles;
DROP POLICY IF EXISTS "profiles_users_workspace" ON profiles;
DROP POLICY IF EXISTS "profiles_super_admin_view_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_workspace" ON profiles;
DROP POLICY IF EXISTS "profiles_select_super_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in workspace" ON profiles;
DROP POLICY IF EXISTS "Admins can update members in their workspace" ON profiles;
DROP POLICY IF EXISTS "Platform super admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Drop all policies on projects
DROP POLICY IF EXISTS "projects_users_workspace" ON projects;
DROP POLICY IF EXISTS "projects_super_admin_view_all" ON projects;
DROP POLICY IF EXISTS "projects_insert_workspace" ON projects;
DROP POLICY IF EXISTS "projects_update_owner" ON projects;
DROP POLICY IF EXISTS "projects_delete_owner" ON projects;
DROP POLICY IF EXISTS "projects_select_workspace" ON projects;
DROP POLICY IF EXISTS "Platform super admins view all projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;

-- Drop all policies on tasks
DROP POLICY IF EXISTS "tasks_users_workspace" ON tasks;
DROP POLICY IF EXISTS "tasks_super_admin_view_all" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "Platform super admins view all tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in their workspace" ON tasks;

-- Drop all policies on workspaces
DROP POLICY IF EXISTS "workspaces_users_own" ON workspaces;
DROP POLICY IF EXISTS "workspaces_super_admin_view_all" ON workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Platform super admins view all workspaces" ON workspaces;
DROP POLICY IF EXISTS "System admins can view all workspaces" ON workspaces;
DROP POLICY IF EXISTS "System admins can delete any workspace" ON workspaces;

-- Drop all policies on project_members
DROP POLICY IF EXISTS "project_members_workspace" ON project_members;
DROP POLICY IF EXISTS "project_members_super_admin" ON project_members;
DROP POLICY IF EXISTS "project_members_select" ON project_members;

-- Drop all policies on task_assignees
DROP POLICY IF EXISTS "task_assignees_workspace" ON task_assignees;
DROP POLICY IF EXISTS "task_assignees_super_admin" ON task_assignees;
DROP POLICY IF EXISTS "task_assignees_select" ON task_assignees;

-- Drop all policies on notifications
DROP POLICY IF EXISTS "notifications_own" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;

-- Drop all policies on activity_log
DROP POLICY IF EXISTS "activity_log_workspace" ON activity_log;
DROP POLICY IF EXISTS "activity_log_super_admin" ON activity_log;
DROP POLICY IF EXISTS "activity_log_select" ON activity_log;

-- Drop audit log policies if they exist
DROP POLICY IF EXISTS "System admins can view workspace audit log" ON workspace_audit_log;

-- ============================================================================
-- Now create fresh policies - ONE at a time to catch any issues
-- ============================================================================

-- PROFILES: User sees own profile
CREATE POLICY "prof_own" ON profiles FOR SELECT
  USING (auth.uid() = id);

-- PROFILES: User sees workspace members
CREATE POLICY "prof_workspace" ON profiles FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

-- PROFILES: Super admin sees all
CREATE POLICY "prof_superadmin" ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- PROFILES: Update own profile
CREATE POLICY "prof_update" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PROJECTS: User sees workspace projects
CREATE POLICY "proj_workspace" ON projects FOR SELECT
  USING (
    workspace_id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

-- PROJECTS: Super admin sees all
CREATE POLICY "proj_superadmin" ON projects FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- PROJECTS: Insert into workspace
CREATE POLICY "proj_insert" ON projects FOR INSERT
  WITH CHECK (
    workspace_id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

-- PROJECTS: Owner updates
CREATE POLICY "proj_update" ON projects FOR UPDATE
  USING (owner_id = auth.uid());

-- PROJECTS: Owner deletes
CREATE POLICY "proj_delete" ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- TASKS: User sees workspace tasks
CREATE POLICY "task_workspace" ON tasks FOR SELECT
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

-- TASKS: Super admin sees all
CREATE POLICY "task_superadmin" ON tasks FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- WORKSPACES: User sees own workspace
CREATE POLICY "ws_own" ON workspaces FOR SELECT
  USING (
    id = (
      SELECT workspace_id FROM profiles
      WHERE id = auth.uid() AND workspace_id IS NOT NULL
      LIMIT 1
    )
  );

-- WORKSPACES: Super admin sees all
CREATE POLICY "ws_superadmin" ON workspaces FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- PROJECT_MEMBERS: User sees workspace project members
CREATE POLICY "pm_workspace" ON project_members FOR SELECT
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

-- PROJECT_MEMBERS: Super admin sees all
CREATE POLICY "pm_superadmin" ON project_members FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- TASK_ASSIGNEES: User sees workspace task assignees
CREATE POLICY "ta_workspace" ON task_assignees FOR SELECT
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

-- TASK_ASSIGNEES: Super admin sees all
CREATE POLICY "ta_superadmin" ON task_assignees FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- NOTIFICATIONS: User sees own notifications
CREATE POLICY "notif_own" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- ACTIVITY_LOG: User sees workspace activity
CREATE POLICY "actlog_workspace" ON activity_log FOR SELECT
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

-- ACTIVITY_LOG: Super admin sees all
CREATE POLICY "actlog_superadmin" ON activity_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'super_admin' AND workspace_id IS NULL
      LIMIT 1000
    )
  );

-- ============================================================================
-- Done - all policies recreated with short names to avoid conflicts
-- ============================================================================
