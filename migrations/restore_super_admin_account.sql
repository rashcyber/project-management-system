-- RESTORE SUPER ADMIN ACCOUNT FOR SALIA ABDUL RASHID

-- STEP 1: Disable RLS to make direct updates
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- STEP 2: Check current state of Salia's account
SELECT '=== CURRENT STATE ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles
WHERE email = 'rashidsalia057@gmail.com';

-- STEP 3: Verify the workspace exists
SELECT '=== WORKSPACE ===' as step;
SELECT id, name, owner_id FROM workspaces LIMIT 1;

-- STEP 4: Get Salia's user ID
SELECT '=== SALIA USER ID ===' as step;
SELECT id, email FROM auth.users WHERE email = 'rashidsalia057@gmail.com';

-- STEP 5: Force update Salia's profile to super_admin with all fields
DO $$
DECLARE
  salia_id UUID;
  salia_workspace_id UUID;
BEGIN
  -- Get Salia's ID
  SELECT id INTO salia_id FROM auth.users WHERE email = 'rashidsalia057@gmail.com' LIMIT 1;

  -- Get a workspace
  SELECT id INTO salia_workspace_id FROM workspaces LIMIT 1;

  IF salia_id IS NOT NULL THEN
    -- Update profile with all necessary fields
    UPDATE profiles
    SET
      role = 'super_admin'::user_role,
      workspace_id = salia_workspace_id,
      email = 'rashidsalia057@gmail.com'
    WHERE profiles.id = salia_id;

    RAISE NOTICE 'Updated profile for user: %', salia_id;
  ELSE
    RAISE EXCEPTION 'User not found!';
  END IF;
END $$;

-- STEP 6: Verify the update
SELECT '=== VERIFICATION ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles
WHERE email = 'rashidsalia057@gmail.com';

-- STEP 7: Check if profile was created correctly
SELECT '=== ALL PROFILES ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles;

-- STEP 8: Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- STEP 9: Final test - can we read the profile?
SELECT '=== FINAL TEST ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles
WHERE id = auth.uid();
