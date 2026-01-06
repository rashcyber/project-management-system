-- Task Dependencies Migration
-- Run this in your Supabase SQL Editor

-- Create task dependencies table for tracking blocking relationships
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocking_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  blocked_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocking_task_id, blocked_task_id)
);

-- Create index for faster lookups
CREATE INDEX idx_task_dependencies_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX idx_task_dependencies_blocked ON task_dependencies(blocked_task_id);

-- Enable RLS on task_dependencies
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view dependencies for tasks they can access
CREATE POLICY "Users can view task dependencies" ON task_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_dependencies.blocking_task_id
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = t.project_id AND user_id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_dependencies.blocked_task_id
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = t.project_id AND user_id = auth.uid()
      )
    )
  );

-- Policy: Users can manage dependencies for tasks they can access
CREATE POLICY "Users can manage task dependencies" ON task_dependencies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_dependencies.blocking_task_id
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = t.project_id AND user_id = auth.uid()
      )
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_task_dependencies_updated_at
  BEFORE UPDATE ON task_dependencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add comment to activity log for dependency changes
COMMENT ON TABLE task_dependencies IS 'Tracks task blocking relationships - which tasks block other tasks from being started';
