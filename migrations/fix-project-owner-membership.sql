-- Fix: Ensure all project owners are added as project members
-- This fixes the issue where owners can't manage tasks due to missing project_members entry

-- Step 1: Identify projects where owner is missing from project_members
SELECT '=== Projects with missing owner membership ===' as status;
SELECT COUNT(*) as missing_count
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = p.owner_id
WHERE p.owner_id IS NOT NULL AND pm.id IS NULL;

-- Step 2: Add all project owners as admin members
INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT
  p.id,
  p.owner_id,
  'admin',
  NOW()
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = p.owner_id
WHERE p.owner_id IS NOT NULL AND pm.id IS NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Step 3: Verify the fix
SELECT '=== Verification: All owners now members ===' as status;
SELECT COUNT(*) as total_projects
FROM projects
WHERE owner_id IS NOT NULL;

SELECT COUNT(*) as owners_in_members
FROM projects p
JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = p.owner_id
WHERE p.owner_id IS NOT NULL;

-- Show the results
SELECT '=== Check: Match should be true ===' as status,
  (SELECT COUNT(*) FROM projects WHERE owner_id IS NOT NULL) =
  (SELECT COUNT(*) FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = p.owner_id WHERE p.owner_id IS NOT NULL)
  as all_owners_are_members;
