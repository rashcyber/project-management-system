-- Debug: Why is task_assignees INSERT failing?

-- Step 1: Check if user is in project_members
SELECT '=== Your Project Memberships ===' as status;
SELECT pm.project_id, pm.user_id, pm.role, p.name
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE pm.user_id = auth.uid();

-- Step 2: Check a recent task
SELECT '=== Sample Task ===' as status;
SELECT id, title, project_id
FROM tasks
ORDER BY created_at DESC
LIMIT 1;

-- Step 3: For that task, check if user has permission via the RLS policy logic
-- (This simulates what the RLS policy checks)
SELECT '=== RLS Policy Check (does user have access to task project?) ===' as status;
SELECT
  t.id as task_id,
  t.project_id as task_project_id,
  auth.uid() as current_user_id,
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
  ) as user_is_member
FROM tasks t
ORDER BY t.created_at DESC
LIMIT 1;

-- Step 4: Show all policies on task_assignees
SELECT '=== Current RLS Policies on task_assignees ===' as status;
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY policyname;

-- Step 5: Check if there are any RESTRICTIVE policies (those are more strict)
SELECT '=== Check for RESTRICTIVE policies ===' as status;
SELECT COUNT(*) as restrictive_count
FROM pg_policies
WHERE tablename = 'task_assignees' AND permissive::text = 'false';
