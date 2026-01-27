-- Ultra Simple Debug - Just the facts

-- Are you a project member?
SELECT 'PROJECT_MEMBERS' as section, COUNT(*) as count FROM project_members WHERE user_id = auth.uid();

-- Can you see a task?
SELECT 'TASKS_COUNT' as section, COUNT(*) as count FROM tasks;

-- What's your user ID?
SELECT 'YOUR_USER_ID' as section, auth.uid()::text as value;

-- Show a task
SELECT 'TASK_SAMPLE' as section, id::text as value FROM tasks LIMIT 1;

-- Show a project you're in
SELECT 'YOUR_PROJECT' as section, project_id::text as value FROM project_members WHERE user_id = auth.uid() LIMIT 1;

-- How many RLS policies on task_assignees?
SELECT 'POLICIES_COUNT' as section, COUNT(*) as count FROM pg_policies WHERE tablename = 'task_assignees';

-- List all policies
SELECT 'POLICY' as section, policyname::text as value FROM pg_policies WHERE tablename = 'task_assignees';
