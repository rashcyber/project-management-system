-- Migration: Fix System Admin Access - Add missing policies and columns
-- This migration fixes the AdminDashboard loading issues by:
-- 1. Ensuring description column exists on workspaces
-- 2. Recreating is_system_admin RLS policies that may have been dropped
-- 3. Adding INSERT policy for audit logging

-- ============================================================================
-- STEP 1: Ensure description column exists on workspaces table
-- ============================================================================
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================================
-- STEP 2: Ensure workspace_audit_log table has proper RLS
-- ============================================================================
-- Enable RLS if not already enabled
ALTER TABLE workspace_audit_log ENABLE ROW LEVEL SECURITY;

-- Add INSERT policy for system admins to log actions
CREATE POLICY IF NOT EXISTS "system_admins_can_insert_audit_log"
  ON workspace_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- Add UPDATE policy for system admins
CREATE POLICY IF NOT EXISTS "system_admins_can_update_audit_log"
  ON workspace_audit_log FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- ============================================================================
-- STEP 3: Recreate is_system_admin RLS policies on profiles table
-- ============================================================================
-- Policy: System admins can view all profiles
CREATE POLICY IF NOT EXISTS "system_admins_view_all_profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- Policy: System admins can update profiles
CREATE POLICY IF NOT EXISTS "system_admins_can_update_profiles"
  ON profiles FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- ============================================================================
-- STEP 4: Recreate is_system_admin RLS policies on workspaces table
-- ============================================================================
-- Policy: System admins can view all workspaces
CREATE POLICY IF NOT EXISTS "system_admins_view_all_workspaces"
  ON workspaces FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- Policy: System admins can delete any workspace
CREATE POLICY IF NOT EXISTS "system_admins_delete_any_workspace"
  ON workspaces FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- ============================================================================
-- STEP 5: Ensure workspace_audit_log SELECT policy exists
-- ============================================================================
CREATE POLICY IF NOT EXISTS "system_admins_can_view_audit_log"
  ON workspace_audit_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE is_system_admin = TRUE
    )
  );

-- ============================================================================
-- STEP 6: Verify is_system_admin column exists on profiles
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_system_admin ON profiles(is_system_admin) WHERE is_system_admin = TRUE;
