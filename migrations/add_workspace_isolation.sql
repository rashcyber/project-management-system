-- Migration: Add workspace isolation for team-based user management
-- This migration adds workspaces table and workspace_id columns to enable
-- multi-tenant workspace isolation

-- 1. Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add workspace_id to profiles table (nullable for migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- 3. Add workspace_id to projects table (nullable for migration)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- 4. Create indexes for workspace_id columns for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);

-- 5. Create RLS policies for workspace isolation

-- Enable RLS on workspaces table
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view workspaces they own
CREATE POLICY "Users can view their workspace"
  ON workspaces FOR SELECT
  USING (owner_id = auth.uid());

-- Policy: Users can view workspaces where they are members
CREATE POLICY "Users can view workspaces they are members of"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
  );

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view profiles in same workspace
CREATE POLICY "Users can view profiles in same workspace"
  ON profiles FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR id = auth.uid()
  );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access projects in same workspace
CREATE POLICY "Users can access projects in same workspace"
  ON projects FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR owner_id = auth.uid()
  );

-- 6. Update existing trigger to create workspace for new users
-- First, drop the old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a new version of the handle_new_user function that also creates a workspace
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  new_workspace_id UUID;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM profiles;

  -- If first user, create a new workspace for them
  IF user_count = 0 THEN
    INSERT INTO workspaces (name, owner_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
      NEW.id
    )
    RETURNING id INTO new_workspace_id;
  ELSE
    -- For invited users, workspace will be set by the edge function
    new_workspace_id := NULL;
  END IF;

  -- Create the profile
  INSERT INTO profiles (id, email, full_name, role, workspace_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'super_admin'::user_role ELSE 'member'::user_role END,
    new_workspace_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger with the new function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. Migration script for existing data
-- This will assign existing users and projects to workspaces

-- For each super_admin without a workspace: create a workspace for them
DO $$
DECLARE
  admin_record RECORD;
  workspace_id UUID;
BEGIN
  FOR admin_record IN
    SELECT id, full_name, email FROM profiles
    WHERE role = 'super_admin' AND workspace_id IS NULL
    ORDER BY created_at ASC
  LOOP
    INSERT INTO workspaces (name, owner_id)
    VALUES (admin_record.full_name || '''s Workspace', admin_record.id)
    RETURNING id INTO workspace_id;

    UPDATE profiles SET workspace_id = workspace_id WHERE id = admin_record.id;
  END LOOP;
END $$;

-- For each admin without a workspace: create a workspace for them
DO $$
DECLARE
  admin_record RECORD;
  workspace_id UUID;
BEGIN
  FOR admin_record IN
    SELECT id, full_name, email FROM profiles
    WHERE role = 'admin' AND workspace_id IS NULL
    ORDER BY created_at ASC
  LOOP
    INSERT INTO workspaces (name, owner_id)
    VALUES (admin_record.full_name || '''s Workspace', admin_record.id)
    RETURNING id INTO workspace_id;

    UPDATE profiles SET workspace_id = workspace_id WHERE id = admin_record.id;
  END LOOP;
END $$;

-- For non-admin users without workspace: assign to the default workspace
-- (created by the first super_admin)
DO $$
DECLARE
  default_workspace_id UUID;
  member_record RECORD;
BEGIN
  -- Get the first workspace (belongs to the first super_admin)
  SELECT id INTO default_workspace_id FROM workspaces ORDER BY created_at ASC LIMIT 1;

  IF default_workspace_id IS NOT NULL THEN
    UPDATE profiles
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL;
  END IF;
END $$;

-- Assign projects to their owner's workspace
DO $$
DECLARE
  project_record RECORD;
BEGIN
  FOR project_record IN
    SELECT p.id, p.owner_id, pr.workspace_id
    FROM projects p
    LEFT JOIN profiles pr ON p.owner_id = pr.id
    WHERE p.workspace_id IS NULL AND pr.workspace_id IS NOT NULL
  LOOP
    UPDATE projects
    SET workspace_id = project_record.workspace_id
    WHERE id = project_record.id;
  END LOOP;
END $$;

-- 8. Add comment to workspaces table for documentation
COMMENT ON TABLE workspaces IS 'Represents isolated workspaces for multi-tenant support. Each workspace can have multiple users.';
COMMENT ON COLUMN workspaces.owner_id IS 'The user who created/owns the workspace (typically a super_admin or admin).';
COMMENT ON COLUMN profiles.workspace_id IS 'The workspace this user belongs to. Enables isolation across tenants.';
COMMENT ON COLUMN projects.workspace_id IS 'The workspace this project belongs to. Projects must be in the same workspace as their members.';
