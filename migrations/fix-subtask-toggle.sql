-- Fix subtask toggle permissions
-- Run this in Supabase SQL Editor

-- Drop old policies
DROP POLICY IF EXISTS "Users can toggle their subtasks" ON subtasks;
DROP POLICY IF EXISTS "Users can toggle assigned subtasks" ON subtasks;

-- Create new policy: Allow subtask assignee OR task creator to toggle
CREATE POLICY "Users can toggle their subtasks" ON subtasks
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_to
  OR auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id IN (
      SELECT project_id FROM tasks
      WHERE id = subtasks.task_id
    )
  )
)
WITH CHECK (
  true
);
