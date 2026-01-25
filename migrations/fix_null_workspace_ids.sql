-- CRITICAL FIX: Assign NULL workspace_ids

-- STEP 1: Disable RLS temporarily
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- STEP 2: Check workspaces
SELECT '=== WORKSPACES ===' as step;
SELECT id, name, owner_id FROM workspaces;

-- STEP 3: Get the first (default) workspace
SELECT '=== DEFAULT WORKSPACE ===' as step;
SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1;

-- STEP 4: Assign all NULL workspace_ids in projects to the default workspace
DO $$
DECLARE
  default_workspace_id UUID;
BEGIN
  -- Get the first workspace
  SELECT id INTO default_workspace_id FROM workspaces ORDER BY created_at ASC LIMIT 1;

  IF default_workspace_id IS NOT NULL THEN
    -- Update all projects with NULL workspace_id
    UPDATE projects
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL;

    RAISE NOTICE 'Updated % projects with NULL workspace_id', FOUND;
  ELSE
    RAISE EXCEPTION 'No workspace found - cannot assign workspace_ids';
  END IF;
END $$;

-- STEP 5: Verify fix
SELECT '=== VERIFICATION: Projects with NULL workspace ===' as step;
SELECT COUNT(*) as null_count FROM projects WHERE workspace_id IS NULL;

-- STEP 6: Assign all NULL workspace_ids in profiles to the default workspace
DO $$
DECLARE
  default_workspace_id UUID;
BEGIN
  SELECT id INTO default_workspace_id FROM workspaces ORDER BY created_at ASC LIMIT 1;

  IF default_workspace_id IS NOT NULL THEN
    UPDATE profiles
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL;

    RAISE NOTICE 'Updated % profiles with NULL workspace_id', FOUND;
  END IF;
END $$;

-- STEP 7: Verify profiles fix
SELECT '=== VERIFICATION: Profiles with NULL workspace ===' as step;
SELECT COUNT(*) as null_count FROM profiles WHERE workspace_id IS NULL;

-- STEP 8: Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- STEP 9: Final check - all profiles and projects should have workspace_id
SELECT '=== FINAL CHECK ===' as step;
SELECT
  'profiles' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as null_workspace_count,
  COUNT(CASE WHEN workspace_id IS NOT NULL THEN 1 END) as with_workspace_count
FROM profiles

UNION ALL

SELECT
  'projects',
  COUNT(*),
  COUNT(CASE WHEN workspace_id IS NULL THEN 1 END),
  COUNT(CASE WHEN workspace_id IS NOT NULL THEN 1 END)
FROM projects;

SELECT '=== SAMPLE DATA AFTER FIX ===' as step;
SELECT 'Profiles sample:' as check_type;
SELECT id, email, workspace_id FROM profiles LIMIT 3;

SELECT '' as separator;
SELECT 'Projects sample:' as check_type;
SELECT id, name, workspace_id FROM projects LIMIT 3;
