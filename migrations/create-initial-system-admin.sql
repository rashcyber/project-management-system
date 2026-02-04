-- Migration: Create initial System Admin (Platform-wide admin)
--
-- IMPORTANT: Understanding the two admin types:
--
-- 1. SYSTEM ADMIN (is_system_admin = TRUE)
--    - Platform-wide access to ALL workspaces
--    - Can delete workspaces, manage other admins
--    - Use this for: administrator1@gmail.com
--    - Accessed via: /admin/dashboard
--
-- 2. SUPER ADMIN (role = 'super_admin')
--    - Workspace owner - manages only THEIR workspace
--    - Can invite users, manage roles within workspace
--    - Use this for: Users who create workspaces
--    - Accessed via: /admin/panel (Workspace Admin)
--
-- SETUP STEPS:
-- 1. Register the new System Admin account (e.g., administrator1@gmail.com)
-- 2. Run this SQL with their email address
-- 3. Log out and log back in
-- 4. They'll see "System Admin" link in Sidebar → /admin/dashboard
--
-- To use: Update the email address below and run in Supabase SQL Editor
UPDATE profiles
SET is_system_admin = TRUE
WHERE email = 'administrator1@gmail.com';
