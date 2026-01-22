-- CRITICAL FIX: Database trigger and invitation flow

-- Fix 1: Update handle_new_user trigger to respect user metadata role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  provided_role TEXT;
BEGIN
  -- Get the role from user metadata if provided
  provided_role := NEW.raw_user_meta_data->>'role';

  -- Count existing users (excluding the one being created)
  SELECT COUNT(*) INTO user_count FROM profiles WHERE id != NEW.id;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      -- If role was explicitly provided (from invitation), use it
      WHEN provided_role IS NOT NULL AND provided_role::text != '' THEN provided_role::user_role
      -- If first user and no role provided, assign super_admin
      WHEN user_count = 0 THEN 'super_admin'::user_role
      -- Otherwise assign member role
      ELSE 'member'::user_role
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Create a table to store pending invitations
-- This allows us to create users without triggering session changes
CREATE TABLE IF NOT EXISTS pending_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  full_name TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_used ON pending_invitations(used);
