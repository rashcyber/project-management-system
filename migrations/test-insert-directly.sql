-- Direct Test: Try to INSERT into task_assignees
-- This will tell us if the RLS policy allows it

-- First, get a task and a user to test with
SELECT '=== Getting test data ===' as step;

-- Get your user ID
SELECT auth.uid() as your_user_id;

-- Get a task you have access to (should be in a project you're a member of)
SELECT id, title, project_id
FROM tasks
WHERE project_id IN (
  SELECT project_id FROM project_members WHERE user_id = auth.uid()
)
LIMIT 1;

-- Get another user to assign
SELECT id, full_name, email
FROM profiles
WHERE id != auth.uid()
LIMIT 1;

-- Now try the INSERT
SELECT '=== Attempting INSERT ===' as step;

-- This will fail if RLS blocks it
WITH task_to_assign AS (
  SELECT id, project_id
  FROM tasks
  WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )
  LIMIT 1
),
user_to_assign AS (
  SELECT id
  FROM profiles
  WHERE id != auth.uid()
  LIMIT 1
)
INSERT INTO task_assignees (task_id, user_id)
SELECT t.id, u.id
FROM task_to_assign t, user_to_assign u
ON CONFLICT (task_id, user_id) DO NOTHING;

-- If we got here without error, it worked!
SELECT '=== Success! INSERT worked ===' as result;

-- Show what was inserted
SELECT COUNT(*) as total_assignments FROM task_assignees;
