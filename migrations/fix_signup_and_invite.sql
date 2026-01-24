-- FIX: Signup and Invite Functionality with Workspace Assignment

-- STEP 1: Fix the handle_new_user trigger to assign workspaces properly
-- This ensures new users get assigned to the owner's workspace (not NULL)

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- STEP 2: Create improved trigger function
-- EVERY new user creates their own workspace and becomes super_admin of it
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- EVERY new user gets their own workspace
  INSERT INTO workspaces (name, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id
  )
  RETURNING id INTO new_workspace_id;

  -- Create the profile - EVERY signup becomes super_admin of their workspace
  INSERT INTO profiles (id, email, full_name, role, workspace_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'super_admin'::user_role,  -- Every new user is super_admin of their workspace
    new_workspace_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- STEP 3: Fix existing users with NULL workspace_id
-- Create a workspace for each user that doesn't have one
DO $$
DECLARE
  user_record RECORD;
  new_workspace_id UUID;
BEGIN
  FOR user_record IN
    SELECT id, full_name, email FROM profiles
    WHERE workspace_id IS NULL
    ORDER BY created_at ASC
  LOOP
    -- Create workspace for this user
    INSERT INTO workspaces (name, owner_id)
    VALUES (user_record.full_name || '''s Workspace', user_record.id)
    RETURNING id INTO new_workspace_id;

    -- Assign workspace to user
    UPDATE profiles SET workspace_id = new_workspace_id WHERE id = user_record.id;
  END LOOP;

  RAISE NOTICE 'Created workspaces for all users without one';
END $$;

-- STEP 4: Verify the fix
SELECT '=== VERIFICATION ===' as step;
SELECT COUNT(*) as total_profiles,
       COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as null_workspace_count
FROM profiles;

SELECT '=== PROFILES WITH WORKSPACES ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles;
