-- Migration: Add System Admin role for platform-wide administration
-- Enables administrators to delete workspaces, view all workspaces, manage platform settings

-- STEP 1: Add is_system_admin flag to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE;

-- STEP 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_system_admin ON profiles(is_system_admin) WHERE is_system_admin = TRUE;

-- STEP 3: Update RLS policies to allow system admins to see all workspaces
-- First, update the workspace policies to include system admin access

-- Policy: System admins can view all workspaces
CREATE POLICY IF NOT EXISTS "System admins can view all workspaces"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Policy: System admins can delete any workspace
CREATE POLICY IF NOT EXISTS "System admins can delete any workspace"
  ON workspaces FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Policy: System admins can view all profiles (for platform management)
CREATE POLICY IF NOT EXISTS "System admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- STEP 4: Add cascading delete constraint if not already present
-- This ensures when a workspace is deleted, all related data is cleaned up
-- (Already handled by foreign key constraints in existing tables)

-- STEP 5: Comment for documentation
COMMENT ON COLUMN profiles.is_system_admin IS 'Boolean flag indicating if user is a system administrator with platform-wide access. System admins can view and delete any workspace.';

-- STEP 6: Grant necessary permissions (if using row-level security)
-- Ensure profiles table RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- STEP 7: Create audit table for workspace deletions (optional but recommended)
CREATE TABLE IF NOT EXISTS workspace_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  workspace_id UUID,
  workspace_name TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit table
ALTER TABLE workspace_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: System admins can view audit log
CREATE POLICY IF NOT EXISTS "System admins can view workspace audit log"
  ON workspace_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- STEP 8: Create function to log workspace deletions
CREATE OR REPLACE FUNCTION log_workspace_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_audit_log (admin_id, workspace_id, workspace_name, action, details)
  VALUES (
    auth.uid(),
    OLD.id,
    OLD.name,
    'WORKSPACE_DELETED',
    jsonb_build_object(
      'owner_id', OLD.owner_id,
      'created_at', OLD.created_at,
      'deleted_at', NOW()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 9: Create trigger for workspace deletion logging
DROP TRIGGER IF EXISTS workspace_deletion_trigger ON workspaces;
CREATE TRIGGER workspace_deletion_trigger
  BEFORE DELETE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION log_workspace_deletion();

-- STEP 10: Verification query (comment out or remove after migration)
-- SELECT '=== System Admin Role Added ===' as status;
-- SELECT COUNT(*) as system_admin_count FROM profiles WHERE is_system_admin = TRUE;
-- SELECT * FROM workspace_audit_log LIMIT 1;
