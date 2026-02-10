-- Migration: Force remove ALL policies regardless of whether they exist
-- This uses CASCADE and removes everything before recreating

-- ============================================================================
-- STEP 1: Force disable RLS on all tables temporarily
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
-- STEP 2: Re-enable RLS (this clears all policies)
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
-- STEP 3: Create fresh, clean policies
-- ============================================================================

-- PROFILES TABLE
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
-- STEP 4: Verification complete
-- ============================================================================
-- All tables now have fresh RLS policies
-- Disabling and re-enabling RLS cleared all old policies automatically
