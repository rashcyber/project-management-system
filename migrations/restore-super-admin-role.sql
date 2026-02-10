-- Migration: Restore super_admin role for the account
-- The account's role was downgraded to 'member', this restores it

-- STEP 1: Find and restore the super_admin account
-- Your account ID: 8f71db61-32e5-4d1f-80c8-180f2a613f61
UPDATE profiles
SET role = 'super_admin'
WHERE id = '8f71db61-32e5-4d1f-80c8-180f2a613f61'
AND role != 'super_admin';

-- STEP 2: Verify the change
SELECT id, email, role, workspace_id
FROM profiles
WHERE id = '8f71db61-32e5-4d1f-80c8-180f2a613f61';

-- STEP 3: Also ensure workspace_id is NULL for platform access
UPDATE profiles
SET workspace_id = NULL
WHERE id = '8f71db61-32e5-4d1f-80c8-180f2a613f61'
AND workspace_id IS NOT NULL;

-- STEP 4: Final verification
SELECT 'Account restored' as status,
  id,
  email,
  role,
  workspace_id
FROM profiles
WHERE id = '8f71db61-32e5-4d1f-80c8-180f2a613f61';
