-- Check your actual authenticated user ID

-- This query shows what YOUR actual user ID should be in the system
-- Run this as a SUPER ADMIN or check the profiles table directly

-- 1. Show all users in the system
SELECT '=== ALL USERS IN SYSTEM ===' as status;
SELECT id, email, full_name, role FROM profiles ORDER BY created_at DESC LIMIT 10;

-- 2. Count total users
SELECT '=== USER COUNT ===' as status;
SELECT COUNT(*) as total_users FROM profiles;

-- 3. Find user by email (tell me your email and I can match)
SELECT '=== USERS BY EMAIL PATTERN ===' as status;
SELECT id, email, full_name FROM profiles WHERE email ILIKE '%@%' ORDER BY created_at DESC LIMIT 20;

-- 4. Check auth.users table (if you have super admin access)
SELECT '=== AUTH USERS ===' as status;
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;
