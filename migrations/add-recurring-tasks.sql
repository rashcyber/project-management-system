-- Migration: Add recurring tasks support
-- Run this in your Supabase SQL Editor

-- Add recurrence columns to tasks table
ALTER TABLE tasks
ADD COLUMN recurrence_pattern JSONB,
ADD COLUMN recurrence_end_date DATE,
ADD COLUMN original_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
ADD COLUMN is_recurring_instance BOOLEAN DEFAULT FALSE;

-- Create recurring_task_instances table to track generated instances
CREATE TABLE recurring_task_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  generated_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  due_date DATE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(original_task_id, generated_task_id)
);

-- Enable RLS on recurring_task_instances
ALTER TABLE recurring_task_instances ENABLE ROW LEVEL SECURITY;

-- Policies for recurring_task_instances
CREATE POLICY "Users can view recurring task instances for their projects" ON recurring_task_instances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = recurring_task_instances.original_task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project members can manage recurring task instances" ON recurring_task_instances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = recurring_task_instances.original_task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_tasks_recurrence_pattern ON tasks USING GIN (recurrence_pattern);
CREATE INDEX idx_tasks_original_task_id ON tasks(original_task_id);
CREATE INDEX idx_tasks_is_recurring_instance ON tasks(is_recurring_instance);
CREATE INDEX idx_recurring_task_instances_original_task_id ON recurring_task_instances(original_task_id);
CREATE INDEX idx_recurring_task_instances_generated_task_id ON recurring_task_instances(generated_task_id);
CREATE INDEX idx_recurring_task_instances_generated_at ON recurring_task_instances(generated_at);

-- Comments
COMMENT ON TABLE recurring_task_instances IS 'Tracks generated task instances from recurring tasks';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'JSON object defining the recurrence pattern (e.g., {"frequency": "weekly", "days": [1, 3, 5]})';
COMMENT ON COLUMN tasks.recurrence_end_date IS 'Date after which no more recurring instances should be generated';
COMMENT ON COLUMN tasks.original_task_id IS 'Reference to the original task if this is a generated recurring instance';
COMMENT ON COLUMN tasks.is_recurring_instance IS 'Flag indicating if this task is a generated instance from a recurring task';
