-- Migration: Add multiple task assignees support
-- Run this in your Supabase SQL Editor

-- Create task_assignees junction table for multiple assignees per task
CREATE TABLE task_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS on task_assignees
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies for task_assignees
CREATE POLICY "Users can view assignees of tasks in their projects" ON task_assignees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project members can manage task assignees" ON task_assignees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_assignees.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user_id ON task_assignees(user_id);

-- Function to get task assignees as array (for easier querying)
CREATE OR REPLACE FUNCTION get_task_assignee_ids(task_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT user_id FROM task_assignees WHERE task_id = task_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Comments to document the table
COMMENT ON TABLE task_assignees IS 'Junction table for multiple assignees per task';
COMMENT ON COLUMN task_assignees.task_id IS 'The task being assigned';
COMMENT ON COLUMN task_assignees.user_id IS 'The user assigned to the task';
