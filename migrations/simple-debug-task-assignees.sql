-- Simple Debug: Task Assignment RLS Issue

-- 1. Check if you're in project_members
SELECT '=== YOUR PROJECT MEMBERSHIPS ===' as info;
SELECT
  pm.project_id,
  p.name as project_name,
  pm.role,
  COUNT(*) as member_count
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE pm.user_id = auth.uid()
GROUP BY pm.project_id, p.name, pm.role;

-- 2. Get a sample task
SELECT '=== SAMPLE TASK ===' as info;
SELECT
  id as task_id,
  title,
  project_id
FROM tasks
ORDER BY created_at DESC
LIMIT 1;

-- 3. Check if current user can access the task's project
SELECT '=== CAN YOU ACCESS TASK PROJECT ===' as info;
SELECT
  t.id as task_id,
  t.title,
  t.project_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
    ) THEN 'YES - RLS allows'
    ELSE 'NO - RLS blocks'
  END as access_allowed
FROM tasks t
ORDER BY t.created_at DESC
LIMIT 1;

-- 4. Show all RLS policies on task_assignees
SELECT '=== RLS POLICIES ON task_assignees ===' as info;
SELECT
  policyname,
  cmd as operation,
  permissive::text as type
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY cmd, policyname;

-- 5. Count existing task assignments (to see if it worked before)
SELECT '=== EXISTING TASK ASSIGNMENTS ===' as info;
SELECT COUNT(*) as total_assignments
FROM task_assignees;

-- 6. Check if there are any problematic NULL project_ids in tasks
SELECT '=== TASKS WITH NULL PROJECT_ID ===' as info;
SELECT COUNT(*) as null_project_count
FROM tasks
WHERE project_id IS NULL;
