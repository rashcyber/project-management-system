-- Cleanup: Remove old/conflicting task_assignees RLS policies
-- Keep only the new clean policies

-- Step 1: Show all current policies
SELECT '=== Current Policies Before Cleanup ===' as status;
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY policyname;

-- Step 2: Drop ALL old policies (we'll recreate the good ones)
DROP POLICY IF EXISTS "Users can view assignees of tasks in their projects" ON task_assignees;
DROP POLICY IF EXISTS "Project members can manage task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Users can view task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Project members can insert task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Project members can update task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Project members can delete task assignees" ON task_assignees;

SELECT '=== All policies dropped ===' as status;

-- Step 3: Create ONLY the correct policies (fresh start)

-- SELECT: Users can view assignees of tasks in their projects
CREATE POLICY "Users can view task assignees"
  ON task_assignees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id
      AND project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: Project members can insert task assignees
CREATE POLICY "Project members can insert task assignees"
  ON task_assignees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id
      AND project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE: Project members can update task assignees
CREATE POLICY "Project members can update task assignees"
  ON task_assignees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id
      AND project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id
      AND project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE: Project members can delete task assignees
CREATE POLICY "Project members can delete task assignees"
  ON task_assignees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id
      AND project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Step 4: Verify clean policies
SELECT '=== Final Policies (Should be 4) ===' as status;
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY policyname;
