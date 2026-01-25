-- COMPREHENSIVE FIX FOR RLS AND ROLE ISSUES
-- This script fixes the workspace assignment and RLS policy issues

-- STEP 1: Check current state
SELECT 'STEP 1: Current database state' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles;
SELECT id, name, owner_id FROM workspaces;

-- STEP 2: Disable RLS temporarily to fix data
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;

-- STEP 3: Get the user's UUID (Salia Abdul Rashid)
-- First, find the user ID from auth.users
SELECT 'STEP 2: Finding user ID' as step;
SELECT id as user_id, email FROM auth.users WHERE email = 'rashidsalia057@gmail.com';

-- STEP 4: Make sure the profile is correct
-- Update your profile to be super_admin
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'rashidsalia057@gmail.com';

-- STEP 5: Ensure workspace exists and is assigned
-- Get or create workspace for super_admin user
DO $$
DECLARE
  user_id UUID;
  user_workspace_id UUID;
  new_workspace_id UUID;
BEGIN
  -- Get the user ID
  SELECT id INTO user_id FROM profiles WHERE email = 'rashidsalia057@gmail.com' LIMIT 1;

  IF user_id IS NOT NULL THEN
    -- Check if user already has a workspace
    SELECT profiles.workspace_id INTO user_workspace_id FROM profiles WHERE profiles.id = user_id;

    IF user_workspace_id IS NULL OR user_workspace_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
      -- Create new workspace for this user
      INSERT INTO workspaces (name, owner_id)
      VALUES ('Salia''s Workspace', user_id)
      RETURNING id INTO new_workspace_id;

      -- Assign workspace to user
      UPDATE profiles SET workspace_id = new_workspace_id WHERE id = user_id;
    END IF;
  END IF;
END $$;

-- STEP 6: Assign all other users to a workspace if they don't have one
DO $$
DECLARE
  default_workspace_id UUID;
  admin_id UUID;
BEGIN
  -- Get the first workspace (should be Salia's)
  SELECT id INTO default_workspace_id FROM workspaces ORDER BY created_at ASC LIMIT 1;

  IF default_workspace_id IS NOT NULL THEN
    -- Assign all users without workspace to the default workspace
    UPDATE profiles
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL OR workspace_id = '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;
END $$;

-- STEP 7: Assign projects to workspaces
UPDATE projects p
SET workspace_id = pr.workspace_id
FROM profiles pr
WHERE p.owner_id = pr.id AND (p.workspace_id IS NULL OR p.workspace_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- STEP 8: Verify data is correct
SELECT 'STEP 3: Verification' as step;
SELECT 'Profiles:' as data_check;
SELECT id, email, full_name, role, workspace_id FROM profiles;

SELECT '' as separator;
SELECT 'Workspaces:' as data_check;
SELECT id, name, owner_id FROM workspaces;

-- STEP 9: Re-enable RLS with proper policies (more permissive to avoid issues)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop old policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can view profiles in same workspace" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can access projects in same workspace" ON projects;

-- Create more permissive RLS policies for authenticated users
CREATE POLICY "Users can view themselves"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles in workspace"
  ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE (role = 'super_admin' OR role = 'admin')
        AND workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Authenticated users can view workspaces they belong to"
  ON workspaces FOR SELECT
  USING (
    id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY "Users can view projects in their workspace"
  ON projects FOR SELECT
  USING (
    workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
    OR owner_id = auth.uid()
  );

-- STEP 10: Final verification
SELECT 'STEP 4: Final Check - Your Profile' as final_check;
SELECT id, email, full_name, role, workspace_id FROM profiles WHERE email = 'rashidsalia057@gmail.com';
