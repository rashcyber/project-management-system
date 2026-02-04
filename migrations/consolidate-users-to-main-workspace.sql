-- Migration: Consolidate all users to the workspace owner's main workspace
--
-- Background:
-- The workspace owner (rashidsalia057@gmail.com) created their workspace manually
-- via the workspace creation form, which created "Salia's WorkSpace"
-- However, other users were assigned to a different workspace created during signup
--
-- This migration:
-- 1. Finds the workspace of the super_admin owner
-- 2. Moves all other users to that workspace
-- 3. Ensures all users are in one unified workspace

BEGIN;

-- Step 1: Identify the workspace owner and their workspace
DO $$
DECLARE
  owner_workspace_id UUID;
  target_user_count INTEGER;
  moved_count INTEGER;
BEGIN
  -- Find the workspace created by the first super_admin (rashidsalia057@gmail.com)
  SELECT w.id INTO owner_workspace_id
  FROM workspaces w
  WHERE w.owner_id = (
    SELECT id FROM profiles WHERE email = 'rashidsalia057@gmail.com' LIMIT 1
  )
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF owner_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Could not find workspace for rashidsalia057@gmail.com';
  END IF;

  -- Count users NOT in the owner''s workspace
  SELECT COUNT(*) INTO target_user_count
  FROM profiles
  WHERE workspace_id != owner_workspace_id;

  RAISE NOTICE '--- Consolidating Users to Main Workspace ---';
  RAISE NOTICE 'Owner workspace ID: %', owner_workspace_id;
  RAISE NOTICE 'Users to move: %', target_user_count;

  -- Move all users to the owner''s workspace
  IF target_user_count > 0 THEN
    UPDATE profiles
    SET workspace_id = owner_workspace_id
    WHERE workspace_id != owner_workspace_id;

    GET DIAGNOSTICS moved_count = ROW_COUNT;
    RAISE NOTICE 'Successfully moved % users to workspace %', moved_count, owner_workspace_id;
  ELSE
    RAISE NOTICE 'All users already in the same workspace!';
  END IF;
END $$;

-- Step 2: Verify the consolidation
SELECT
  COUNT(*) as total_users,
  COUNT(DISTINCT workspace_id) as workspace_count
FROM profiles;

-- Step 3: Show all users in their consolidated workspace
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  w.name as workspace_name,
  p.created_at
FROM profiles p
LEFT JOIN workspaces w ON p.workspace_id = w.id
ORDER BY p.created_at ASC;

-- Step 4: Show workspace details
SELECT
  w.id,
  w.name,
  (SELECT COUNT(*) FROM profiles WHERE workspace_id = w.id) as member_count,
  p.full_name as owner_name,
  w.created_at
FROM workspaces w
LEFT JOIN profiles p ON w.owner_id = p.id
ORDER BY w.created_at ASC;

COMMIT;
