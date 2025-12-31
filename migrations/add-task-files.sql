-- Add file attachments table
-- Run this in Supabase SQL Editor

-- Files table for task attachments
CREATE TABLE task_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on task_files
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files on accessible tasks
CREATE POLICY "Users can view files on accessible tasks" ON task_files
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE t.id = task_files.task_id AND pm.user_id = auth.uid()
  )
);

-- Policy: Project members can upload files
CREATE POLICY "Project members can upload files" ON task_files
FOR INSERT WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id IN (
      SELECT project_id FROM tasks WHERE id = task_files.task_id
    ) AND user_id = auth.uid()
  )
);

-- Policy: Users can delete their own uploaded files
CREATE POLICY "Users can delete their own files" ON task_files
FOR DELETE USING (uploaded_by = auth.uid());

-- Create index
CREATE INDEX idx_task_files_task_id ON task_files(task_id);
