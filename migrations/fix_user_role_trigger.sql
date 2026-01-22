-- Fix the handle_new_user trigger to properly handle invited users with specified roles
-- This migration updates the trigger to check if a role was provided in user metadata
-- If a role is provided (from invitations), use it. Otherwise, assign super_admin to first user.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  provided_role TEXT;
BEGIN
  -- Check if a role was explicitly provided in user metadata
  provided_role := NEW.raw_user_meta_data->>'role';

  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM profiles;

  -- If role was explicitly provided (from invitation), use it
  -- Otherwise, first user becomes super_admin, others become member
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN provided_role IS NOT NULL THEN provided_role::user_role
      WHEN user_count = 0 THEN 'super_admin'::user_role
      ELSE 'member'::user_role
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself doesn't need to change, just the function
-- Trigger definition:
-- CREATE OR REPLACE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();
