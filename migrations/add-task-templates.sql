-- Create task_templates table for storing reusable task templates
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Template content
  title_template VARCHAR(255),
  description_template TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  estimated_hours DECIMAL(10, 2),

  -- Nested arrays/objects for complex data
  subtasks JSONB DEFAULT '[]'::JSONB, -- Array of {title, estimated_hours}
  labels JSONB DEFAULT '[]'::JSONB,   -- Array of label IDs
  assignee_ids JSONB DEFAULT '[]'::JSONB, -- Array of user IDs

  -- Metadata
  is_public BOOLEAN DEFAULT FALSE, -- Shared with team
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT template_name_unique_per_workspace UNIQUE(workspace_id, created_by, name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_templates_workspace ON task_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_project ON task_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_created_by ON task_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_task_templates_is_public ON task_templates(is_public);

-- Add RLS policies
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own templates
CREATE POLICY task_templates_view_own ON task_templates FOR SELECT
  USING (created_by = auth.uid());

-- Policy: Users can view public templates in their workspace
CREATE POLICY task_templates_view_public ON task_templates FOR SELECT
  USING (
    is_public = TRUE AND
    workspace_id = (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can create templates
CREATE POLICY task_templates_create ON task_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    workspace_id = (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update their own templates
CREATE POLICY task_templates_update_own ON task_templates FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own templates
CREATE POLICY task_templates_delete_own ON task_templates FOR DELETE
  USING (created_by = auth.uid());

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_templates_updated_at BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_task_templates_updated_at();

-- Add comments
COMMENT ON TABLE task_templates IS 'Reusable task templates for quick task creation';
COMMENT ON COLUMN task_templates.subtasks IS 'JSON array of subtask templates: [{title, estimated_hours}]';
COMMENT ON COLUMN task_templates.labels IS 'JSON array of label IDs to apply to tasks created from this template';
COMMENT ON COLUMN task_templates.assignee_ids IS 'JSON array of user IDs to assign to tasks created from this template';
COMMENT ON COLUMN task_templates.is_public IS 'If true, template is visible to all workspace members';
