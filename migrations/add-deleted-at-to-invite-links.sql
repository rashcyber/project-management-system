-- Migration: Add soft delete support to invite_links
-- This allows soft-deleting links instead of hard-deleting them

-- Add deleted_at column to invite_links
ALTER TABLE invite_links
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for deleted_at for performance
CREATE INDEX IF NOT EXISTS idx_invite_links_deleted_at ON invite_links(deleted_at);

-- Update RLS policy to exclude soft-deleted links by default
DROP POLICY IF EXISTS "Users can view invite links they created" ON invite_links;

-- New policy that respects soft deletes
CREATE POLICY "Users can view non-deleted invite links they created"
  ON invite_links FOR SELECT
  USING (
    created_by = auth.uid() AND deleted_at IS NULL
  );

-- Allow updating non-deleted links
DROP POLICY IF EXISTS "Users can update their invite links" ON invite_links;
CREATE POLICY "Users can update non-deleted invite links"
  ON invite_links FOR UPDATE
  USING (
    created_by = auth.uid() AND deleted_at IS NULL
  );

-- Verification
SELECT '=== Invite Links Soft Delete Support Added ===' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invite_links' AND column_name IN ('deleted_at', 'is_active')
ORDER BY column_name;
