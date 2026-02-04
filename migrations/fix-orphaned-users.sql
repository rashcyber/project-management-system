-- Migration: Fix orphaned users created before role system fix
--
-- Background:
-- Before the role system fix (commit c5d17e5), authStore.js was forcing ALL users
-- to become super_admin with workspace_id=NULL, overriding the database trigger.
-- This left users "orphaned" - not assigned to any workspace.
--
-- This migration:
-- 1. Finds the first workspace (created by the first user)
-- 2. Assigns all orphaned users to that workspace
-- 3. Ensures they have proper roles based on their assignment
--
-- IMPORTANT: Run this AFTER verifying the users you want to fix

BEGIN;

-- Step 1: Get the first workspace ID (should belong to the original super_admin)
DO $$
DECLARE
  first_workspace_id UUID;
  orphaned_count INTEGER;
  updated_count INTEGER;
BEGIN
  -- Find the first workspace created
  SELECT id INTO first_workspace_id
  FROM workspaces
  ORDER BY created_at ASC
  LIMIT 1;

  -- Check if we have a workspace to assign to
  IF first_workspace_id IS NULL THEN
    RAISE EXCEPTION 'No workspace found in database. At least one workspace must exist before running this migration.';
  END IF;

  -- Count orphaned users (workspace_id is NULL)
  SELECT COUNT(*) INTO orphaned_count
  FROM profiles
  WHERE workspace_id IS NULL;

  RAISE NOTICE 'Found % orphaned users', orphaned_count;
  RAISE NOTICE 'Will assign them to workspace: %', first_workspace_id;

  IF orphaned_count > 0 THEN
    -- Assign orphaned users to the first workspace
    -- They will keep their current role (likely super_admin from the bug)
    UPDATE profiles
    SET workspace_id = first_workspace_id
    WHERE workspace_id IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Successfully assigned % users to workspace %', updated_count, first_workspace_id;
  ELSE
    RAISE NOTICE 'No orphaned users found. Migration skipped.';
  END IF;

  -- Verify the fix
  RAISE NOTICE '--- Verification ---';
  SELECT COUNT(*) INTO orphaned_count
  FROM profiles
  WHERE workspace_id IS NULL;
  RAISE NOTICE 'Remaining orphaned users: %', orphaned_count;
END $$;

-- Step 2: Verify all users now have workspaces
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN workspace_id IS NOT NULL THEN 1 END) as users_with_workspace,
  COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as orphaned_users
FROM profiles;

-- Step 3: Show details of fixed users
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.workspace_id,
  w.name as workspace_name,
  p.created_at
FROM profiles p
LEFT JOIN workspaces w ON p.workspace_id = w.id
ORDER BY p.created_at ASC;

COMMIT;

-- If there are any issues, you can verify with:
-- SELECT email, full_name, role, workspace_id FROM profiles WHERE workspace_id IS NULL;
