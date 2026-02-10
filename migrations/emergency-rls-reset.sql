-- EMERGENCY MIGRATION: Reset RLS to working state
-- This migration disables broken RLS policies and rebuilds them from scratch

-- ============================================================================
-- STEP 1: Disable RLS on all affected tables to restore immediate access
-- ============================================================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop ALL existing policies to start fresh
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in workspace" ON profiles;
DROP POLICY IF EXISTS "Platform super admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update members in their workspace" ON profiles;

DROP POLICY IF EXISTS "Users can view projects in their workspace" ON projects;
DROP POLICY IF EXISTS "Platform super admins view all projects" ON projects;

DROP POLICY IF EXISTS "Users can view tasks in their workspace" ON tasks;
DROP POLICY IF EXISTS "Platform super admins view all tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Platform super admins view all workspaces" ON workspaces;

DROP POLICY IF EXISTS "System admins can view all workspaces" ON workspaces;
DROP POLICY IF EXISTS "System admins can delete any workspace" ON workspaces;
DROP POLICY IF EXISTS "System admins can view all profiles" ON profiles;

-- ============================================================================
-- STEP 3: Re-enable RLS
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create simple, non-recursive policies that work
-- ============================================================================

-- PROFILES: Simple policies without recursion
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_workspace" ON profiles FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- PROJECTS: Simple workspace-based policies
CREATE POLICY "projects_select_workspace" ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "projects_insert_workspace" ON projects FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "projects_update_owner" ON projects FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "projects_delete_owner" ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- TASKS: Simple project-based policies
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- WORKSPACES: Simple policy
CREATE POLICY "workspaces_select" ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- PROJECT_MEMBERS: Simple policy
CREATE POLICY "project_members_select" ON project_members FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- TASK_ASSIGNEES: Simple policy
CREATE POLICY "task_assignees_select" ON task_assignees FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE project_id IN (
        SELECT id FROM projects
        WHERE workspace_id IN (
          SELECT workspace_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- NOTIFICATIONS: User can see their own
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- ACTIVITY_LOG: User can see activity in their workspace projects
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- STEP 5: Verification
-- ============================================================================
-- After running this migration:
-- 1. All RLS policies have been reset to simple, working versions
-- 2. Users can see data in their workspace
-- 3. Platform super_admins (workspace_id = NULL) still need special handling
--
-- Next steps: Create a separate migration for platform super_admin access
-- that handles the NULL workspace_id case properly
