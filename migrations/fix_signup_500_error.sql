-- Fix signup 500 error by ensuring RLS policies allow trigger execution
-- Issue: Signup fails because the trigger can't insert profiles due to RLS

-- STEP 1: Disable RLS temporarily on profiles to fix the trigger
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop and recreate the trigger function with proper error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  new_workspace_id UUID;
BEGIN
  -- Count existing users (without RLS since we're SECURITY DEFINER)
  SELECT COUNT(*) INTO user_count FROM profiles;

  -- If first user, create a new workspace for them
  IF user_count = 0 THEN
    INSERT INTO workspaces (name, owner_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
      NEW.id
    )
    RETURNING id INTO new_workspace_id;
  ELSE
    -- For invited users, workspace will be set by the edge function
    new_workspace_id := NULL;
  END IF;

  -- Create the profile
  INSERT INTO profiles (id, email, full_name, role, workspace_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'super_admin'::user_role ELSE 'member'::user_role END,
    new_workspace_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 3: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- STEP 4: Re-enable RLS on profiles and add comprehensive policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on profiles to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "System can create profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in same workspace" ON profiles;

-- Create new comprehensive policies
-- SELECT: Authenticated users can view their own profile and profiles in their workspace
CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id -- Can always view own profile
    OR (
      auth.uid() IS NOT NULL
      AND workspace_id IN (
        SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
      )
    )
    OR auth.uid() IS NULL -- Allow during signup when no user context
  );

-- UPDATE: Users can update their own profile, admins can update any
CREATE POLICY "Users can update their profile"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  );

-- INSERT: Allow during signup (trigger) and admin operations
CREATE POLICY "Profiles can be created"
  ON profiles FOR INSERT
  WITH CHECK (true); -- Allows trigger to insert during signup

-- DELETE: Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin'))
  );

-- STEP 5: Ensure workspaces RLS is correct
DROP POLICY IF EXISTS "Users can view their workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON workspaces;
DROP POLICY IF EXISTS "System can create workspaces" ON workspaces;

CREATE POLICY "Users can view workspaces"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() AND workspace_id IS NOT NULL
    )
    OR auth.uid() IS NULL -- Allow during signup
  );

CREATE POLICY "Workspaces can be created"
  ON workspaces FOR INSERT
  WITH CHECK (true); -- Allows trigger to create workspace during signup

CREATE POLICY "Workspace owner can update"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- STEP 6: Ensure invite_links table has proper policies
DROP POLICY IF EXISTS "Admins can view workspace invite links" ON invite_links;
DROP POLICY IF EXISTS "Admins can create invite links" ON invite_links;
DROP POLICY IF EXISTS "Admins can update invite links" ON invite_links;
DROP POLICY IF EXISTS "Admins can delete invite links" ON invite_links;
DROP POLICY IF EXISTS "Anyone can view invite by code" ON invite_links;
DROP POLICY IF EXISTS "System can create invite links" ON invite_links;
DROP POLICY IF EXISTS "System can update invite links" ON invite_links;

-- Authenticated admins can view their workspace's invite links
CREATE POLICY "Admins can view invite links"
  ON invite_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = invite_links.workspace_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Public: anyone can access active, non-expired, non-maxed-out links by code
CREATE POLICY "Anyone can view active invite links"
  ON invite_links FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR used_count < max_uses)
  );

-- Admins can create invite links
CREATE POLICY "Admins can create invite links"
  ON invite_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Admins can update their workspace's invite links
CREATE POLICY "Admins can update invite links"
  ON invite_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = invite_links.workspace_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = invite_links.workspace_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- System can update links (for incrementing used_count)
CREATE POLICY "System can update invite links"
  ON invite_links FOR UPDATE
  WITH CHECK (true);

-- STEP 7: Verify RLS configuration
SELECT '=== MIGRATION COMPLETE ===' as step;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'workspaces', 'invite_links');

SELECT '=== PROFILES POLICIES ===' as status;
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'profiles';

SELECT '=== WORKSPACES POLICIES ===' as status;
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'workspaces';

SELECT '=== INVITE_LINKS POLICIES ===' as status;
SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'invite_links';
