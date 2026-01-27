-- Fix: Allow project members to insert task assignees
-- The previous "FOR ALL" policy was too restrictive and didn't allow INSERT operations

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Project members can manage task assignees" ON task_assignees;

-- Step 2: Create separate policies for different operations

-- SELECT policy: Project members can view assignees of tasks in their projects
CREATE POLICY "Users can view task assignees" ON task_assignees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT policy: Project members can assign users to tasks
CREATE POLICY "Project members can insert task assignees" ON task_assignees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE policy: Project members can update task assignees
CREATE POLICY "Project members can update task assignees" ON task_assignees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE policy: Project members can delete task assignees
CREATE POLICY "Project members can delete task assignees" ON task_assignees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- Verification: Check policies are in place
SELECT '=== RLS Policies for task_assignees ===' as status;
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'task_assignees'
ORDER BY policyname;
