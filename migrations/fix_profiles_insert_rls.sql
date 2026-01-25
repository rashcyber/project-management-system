-- Fix RLS policies to allow profile insertion during signup
-- The issue: Signup fails with 500 error because profiles table doesn't have INSERT policy

-- STEP 1: Check if policies already exist to avoid duplicates
DO $$
BEGIN
  -- Add INSERT policy for profiles table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'System can create profiles'
  ) THEN
    CREATE POLICY "System can create profiles"
      ON profiles FOR INSERT
      WITH CHECK (true);
  END IF;

  -- Add INSERT policy for workspaces table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'System can create workspaces'
  ) THEN
    CREATE POLICY "System can create workspaces"
      ON workspaces FOR INSERT
      WITH CHECK (true);
  END IF;

  -- Add UPDATE policy for invite_links to allow incrementing used_count
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invite_links' AND policyname = 'System can update invite links'
  ) THEN
    CREATE POLICY "System can update invite links"
      ON invite_links FOR UPDATE
      WITH CHECK (true);
  END IF;

  -- Add INSERT policy for invite_links for system operations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invite_links' AND policyname = 'System can create invite links'
  ) THEN
    CREATE POLICY "System can create invite links"
      ON invite_links FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- STEP 2: Verify policies are in place
SELECT '=== PROFILES POLICIES ===' as step;
SELECT policyname FROM pg_policies WHERE tablename = 'profiles' ORDER BY policyname;

SELECT '=== WORKSPACES POLICIES ===' as step;
SELECT policyname FROM pg_policies WHERE tablename = 'workspaces' ORDER BY policyname;

SELECT '=== INVITE_LINKS POLICIES ===' as step;
SELECT policyname FROM pg_policies WHERE tablename = 'invite_links' ORDER BY policyname;
