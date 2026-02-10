-- Add archive columns to workspaces table
ALTER TABLE IF EXISTS workspaces ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS workspaces ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS workspaces ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for efficient archived workspace queries
CREATE INDEX IF NOT EXISTS idx_workspaces_is_archived ON workspaces(is_archived);
CREATE INDEX IF NOT EXISTS idx_workspaces_archived_at ON workspaces(archived_at);

-- Update RLS policy to allow system admins to update workspaces (for archive)
-- This allows system admins to update the is_archived, archived_at, archived_by fields
DROP POLICY IF EXISTS "System admins can update any workspace" ON workspaces;

CREATE POLICY "System admins can update any workspace"
  ON workspaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );
