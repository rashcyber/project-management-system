-- COMPLETE RLS REBUILD - DISABLE ALL PROBLEMATIC POLICIES

-- STEP 1: DISABLE RLS ON ALL TABLES
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- STEP 2: DROP ALL EXISTING RLS POLICIES
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

SELECT '=== ALL POLICIES DROPPED ===' as step;
SELECT COUNT(*) as remaining_policies FROM pg_policies WHERE schemaname = 'public';

-- STEP 3: RE-ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- STEP 4: CREATE SIMPLE, PERMISSIVE POLICIES FOR AUTHENTICATED USERS

-- PROFILES: Allow all authenticated users to read profiles
CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- PROFILES: Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PROFILES: Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  );

-- PROJECTS: Allow all authenticated users to read projects
CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- PROJECTS: Allow authenticated users to create projects
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- PROJECTS: Project owner can update project
CREATE POLICY "Project owner can update project"
  ON projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- PROJECTS: Project owner can delete project
CREATE POLICY "Project owner can delete project"
  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- PROJECTS: Admins can update any project
CREATE POLICY "Admins can update any project"
  ON projects FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  );

-- PROJECTS: Admins can delete any project
CREATE POLICY "Admins can delete any project"
  ON projects FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  );

-- WORKSPACES: Allow all authenticated users to view workspaces
CREATE POLICY "Authenticated users can view workspaces"
  ON workspaces FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- WORKSPACES: Workspace owner can update workspace
CREATE POLICY "Workspace owner can update workspace"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- NOTIFICATIONS: Allow users to view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- NOTIFICATIONS: Allow system to create notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- NOTIFICATIONS: Allow users to update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS: Allow users to delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- TASKS: Allow all authenticated users to view tasks
CREATE POLICY "Authenticated users can view tasks"
  ON tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- TASKS: Allow authenticated users to create tasks
CREATE POLICY "Authenticated users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- TASKS: Task creator can update task
CREATE POLICY "Task creator can update task"
  ON tasks FOR UPDATE
  USING (created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
  ))
  WITH CHECK (created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
  ));

-- PROJECT_MEMBERS: Allow all authenticated users to view
CREATE POLICY "Authenticated users can view project members"
  ON project_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- PROJECT_MEMBERS: Allow project members to manage
CREATE POLICY "Project members can manage"
  ON project_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ACTIVITY_LOG: Allow all authenticated users to view
CREATE POLICY "Authenticated users can view activity log"
  ON activity_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ACTIVITY_LOG: System can create activity logs
CREATE POLICY "System can create activity logs"
  ON activity_log FOR INSERT
  WITH CHECK (true);

-- COMMENTS: Allow all authenticated users to view
CREATE POLICY "Authenticated users can view comments"
  ON comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- COMMENTS: Allow authenticated users to create comments
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- COMMENTS: Comment creator can update
CREATE POLICY "Comment creator can update comment"
  ON comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- COMMENTS: Comment creator can delete
CREATE POLICY "Comment creator can delete comment"
  ON comments FOR DELETE
  USING (user_id = auth.uid());

-- STEP 5: VERIFY NEW POLICIES
SELECT '=== NEW RLS POLICIES ===' as step;
SELECT tablename, COUNT(*) as policy_count FROM pg_policies WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- STEP 6: TEST QUERIES
SELECT '=== TEST 1: Query profiles ===' as test;
SELECT COUNT(*) as profile_count FROM profiles;

SELECT '=== TEST 2: Query projects ===' as test;
SELECT COUNT(*) as project_count FROM projects;

SELECT '=== TEST 3: Query workspaces ===' as test;
SELECT COUNT(*) as workspace_count FROM workspaces;

SELECT '=== TEST 4: Query notifications ===' as test;
SELECT COUNT(*) as notification_count FROM notifications;

SELECT '=== TEST 5: Salia''s profile ===' as test;
SELECT id, email, role FROM profiles WHERE email = 'rashidsalia057@gmail.com';
