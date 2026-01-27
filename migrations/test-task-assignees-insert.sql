-- Test: Try to insert a task assignee directly
-- This will show if the RLS policy allows inserts

-- Step 1: Get a task and a user to test with
SELECT '=== Sample Data ===' as status;
WITH task_info AS (
  SELECT id, project_id, title FROM tasks ORDER BY created_at DESC LIMIT 1
),
user_info AS (
  SELECT id, full_name, email FROM profiles LIMIT 1
)
SELECT
  t.id as task_id,
  t.project_id,
  t.title,
  u.id as user_id,
  u.full_name,
  u.email
FROM task_info t, user_info u;

-- Step 2: Try to insert (this will fail if RLS doesn't allow it)
-- Uncomment below to test:
--
-- WITH sample_task AS (
--   SELECT id, project_id FROM tasks ORDER BY created_at DESC LIMIT 1
-- ),
-- sample_user AS (
--   SELECT id FROM profiles LIMIT 1
-- )
-- INSERT INTO task_assignees (task_id, user_id)
-- SELECT t.id, u.id
-- FROM sample_task t, sample_user u
-- ON CONFLICT (task_id, user_id) DO NOTHING;
