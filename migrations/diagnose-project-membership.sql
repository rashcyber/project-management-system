-- Diagnostic: Check project membership and permissions
-- Run this to verify project member setup

-- Check current user's ID (replace with your actual user ID)
SELECT '=== Current User ===' as status;
SELECT auth.uid() as current_user_id;

-- Check projects you own
SELECT '=== Projects You Own ===' as status;
SELECT p.id, p.name, p.owner_id
FROM projects p
WHERE p.owner_id = auth.uid()
LIMIT 10;

-- Check projects you're a member of
SELECT '=== Projects You Are A Member Of ===' as status;
SELECT pm.project_id, pm.user_id, pm.role, p.name
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE pm.user_id = auth.uid()
LIMIT 10;

-- Check if there are any projects where you're the owner but NOT a member
SELECT '=== PROBLEM: You Own But Not A Member ===' as status;
SELECT p.id, p.name, p.owner_id
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = p.owner_id
WHERE p.owner_id = auth.uid() AND pm.id IS NULL
LIMIT 10;

-- If problem found, fix it by adding all project owners as members
-- Uncomment and run this to fix:
-- INSERT INTO project_members (project_id, user_id, role)
-- SELECT p.id, p.owner_id, 'admin'
-- FROM projects p
-- LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = p.owner_id
-- WHERE p.owner_id = auth.uid() AND pm.id IS NULL
-- ON CONFLICT (project_id, user_id) DO NOTHING;
