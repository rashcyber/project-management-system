-- Migration: Create initial system admin account
-- This sets a registered user as a system admin with global platform access
-- Run this SQL in Supabase after the user with email below has registered

-- To use: Update the email address below and run in Supabase SQL Editor
UPDATE profiles
SET is_system_admin = TRUE
WHERE email = 'administrator1@gmail.com';
