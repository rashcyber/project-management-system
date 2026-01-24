-- Create invitation links table for workspace onboarding

-- STEP 1: Create invite_links table
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,  -- Unique code for the link
  role TEXT NOT NULL DEFAULT 'member',  -- Default role for users using this link
  max_uses INTEGER,  -- NULL = unlimited uses
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- STEP 2: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
CREATE INDEX IF NOT EXISTS idx_invite_links_workspace_id ON invite_links(workspace_id);

-- STEP 3: Enable RLS
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS policies
-- Workspace admins can view their workspace's invite links
CREATE POLICY "Admins can view workspace invite links"
  ON invite_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = invite_links.workspace_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Workspace admins can create invite links
CREATE POLICY "Admins can create invite links"
  ON invite_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = (SELECT workspace_id FROM workspaces WHERE id = invite_links.workspace_id)
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Workspace admins can update their invite links
CREATE POLICY "Admins can update invite links"
  ON invite_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = invite_links.workspace_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Workspace admins can delete their invite links
CREATE POLICY "Admins can delete invite links"
  ON invite_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.workspace_id = invite_links.workspace_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Public: anyone can access by code (for signup)
CREATE POLICY "Anyone can view invite by code"
  ON invite_links FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR used_count < max_uses)
  );

-- STEP 5: Add comment
COMMENT ON TABLE invite_links IS 'Shareable invitation links for workspace onboarding. Users can sign up with a link to automatically join a workspace.';
COMMENT ON COLUMN invite_links.code IS 'Unique code for the invite link (e.g., "salia-team-2024")';
COMMENT ON COLUMN invite_links.role IS 'Default role for users who join via this link';
COMMENT ON COLUMN invite_links.max_uses IS 'Maximum number of times this link can be used (NULL = unlimited)';

-- STEP 6: Verify
SELECT '=== INVITE LINKS TABLE CREATED ===' as step;
SELECT * FROM information_schema.columns
WHERE table_name = 'invite_links'
ORDER BY ordinal_position;
