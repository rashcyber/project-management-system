-- Migration: Add time tracking support to tasks
-- Run this in your Supabase SQL Editor

-- Add time tracking columns to tasks table
ALTER TABLE tasks
ADD COLUMN estimated_hours DECIMAL(5,2),
ADD COLUMN actual_hours DECIMAL(5,2) DEFAULT 0,
ADD COLUMN time_entries JSONB DEFAULT '[]'::jsonb;

-- Create time_entries table for detailed time tracking
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL,
  description TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policies for time_entries
CREATE POLICY "Users can view time entries for tasks in their projects" ON time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = time_entries.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create time entries for their tasks" ON time_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM tasks
      WHERE id = time_entries.task_id AND project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own time entries" ON time_entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own time entries" ON time_entries
  FOR DELETE USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_time_entries_logged_at ON time_entries(logged_at);
CREATE INDEX idx_tasks_estimated_hours ON tasks(estimated_hours);
CREATE INDEX idx_tasks_actual_hours ON tasks(actual_hours);

-- Comments
COMMENT ON TABLE time_entries IS 'Tracks individual time log entries for tasks';
COMMENT ON COLUMN tasks.estimated_hours IS 'Estimated hours to complete the task';
COMMENT ON COLUMN tasks.actual_hours IS 'Total actual hours spent on the task';
COMMENT ON COLUMN tasks.time_entries IS 'Denormalized array of time entries for quick access';
