-- Migration: Move all users to "Salia's WorkSpace"
--
-- Problem:
-- User manually created "Salia's WorkSpace" (Feb 4)
-- But all team members are in "Salia Abdul Rashid's Workspace" (Jan 24)
--
-- Solution:
-- Move all 7 users to "Salia's WorkSpace" where the owner is

BEGIN;

DO $$
DECLARE
  target_workspace_id UUID;
  source_workspace_id UUID;
  moved_count INTEGER;
BEGIN
  -- Find "Salia's WorkSpace" (the newer one created Feb 4)
  SELECT id INTO target_workspace_id
  FROM workspaces
  WHERE name = 'Salia''s WorkSpace'
  AND created_at > '2026-02-04'::timestamp
  LIMIT 1;

  -- Find "Salia Abdul Rashid's Workspace" (the older one from Jan 24)
  SELECT id INTO source_workspace_id
  FROM workspaces
  WHERE name = 'Salia Abdul Rashid''s Workspace'
  AND created_at < '2026-02-01'::timestamp
  LIMIT 1;

  IF target_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Could not find "Salia''s WorkSpace"';
  END IF;

  IF source_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Could not find "Salia Abdul Rashid''s Workspace"';
  END IF;

  RAISE NOTICE '--- Moving Users to Salia''s WorkSpace ---';
  RAISE NOTICE 'Source workspace: % (ID: %)', 'Salia Abdul Rashid''s Workspace', source_workspace_id;
  RAISE NOTICE 'Target workspace: % (ID: %)', 'Salia''s WorkSpace', target_workspace_id;

  -- Move all users from source to target workspace
  UPDATE profiles
  SET workspace_id = target_workspace_id
  WHERE workspace_id = source_workspace_id;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Moved % users', moved_count;

  -- Verify
  SELECT COUNT(*) INTO moved_count
  FROM profiles
  WHERE workspace_id = target_workspace_id;

  RAISE NOTICE 'Total users now in target workspace: %', moved_count;
END $$;

COMMIT;

-- Show final result
SELECT
  'Final Workspace State' as status,
  w.name as workspace_name,
  (SELECT COUNT(*) FROM profiles WHERE workspace_id = w.id) as member_count,
  p.full_name as owner
FROM workspaces w
LEFT JOIN profiles p ON w.owner_id = p.id
ORDER BY w.created_at DESC;

-- Show all users
SELECT
  p.email,
  p.full_name,
  p.role,
  w.name as workspace_name
FROM profiles p
LEFT JOIN workspaces w ON p.workspace_id = w.id
ORDER BY p.created_at ASC;
