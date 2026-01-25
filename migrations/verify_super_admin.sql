-- VERIFY SALIA'S SUPER ADMIN STATUS

SELECT '=== SALIA ABDUL RASHID PROFILE ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles
WHERE email = 'rashidsalia057@gmail.com';

SELECT '=== ALL PROFILES ===' as step;
SELECT id, email, full_name, role, workspace_id FROM profiles;

SELECT '=== WORKSPACES ===' as step;
SELECT id, name, owner_id FROM workspaces;

SELECT '=== AUTH USERS ===' as step;
SELECT id, email FROM auth.users WHERE email = 'rashidsalia057@gmail.com';
