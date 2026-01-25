-- EXPORT VERIFICATION DATA

-- Check Salia's profile
SELECT 'SALIA_PROFILE' as section,
       id as user_id,
       email,
       full_name,
       role,
       workspace_id::text as workspace_id
FROM profiles
WHERE email = 'rashidsalia057@gmail.com'

UNION ALL

-- Check all profiles
SELECT 'ALL_PROFILES',
       id,
       email,
       full_name,
       role,
       workspace_id::text
FROM profiles

UNION ALL

-- Check workspaces
SELECT 'WORKSPACES',
       id,
       name,
       owner_id::text,
       null,
       null
FROM workspaces;
