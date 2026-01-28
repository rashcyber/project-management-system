-- Fix: Allow users to be added to project_members during project creation

-- Step 1: Check current RLS policies on project_members
SELECT '=== Current RLS Policies on project_members ===' as status;
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'project_members'
ORDER BY policyname;

-- Step 2: Drop problematic policies
DROP POLICY IF EXISTS "Users can view their project memberships" ON project_members;
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Project admins can manage members" ON project_members;
DROP POLICY IF EXISTS "Project owners can add members" ON project_members;
DROP POLICY IF EXISTS "Members can view other members" ON project_members;
DROP POLICY IF EXISTS "Admins can manage members" ON project_members;

-- Step 3: Disable RLS temporarily to see if that's the issue
-- (We'll re-enable with better policies)
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

SELECT '=== RLS Temporarily Disabled on project_members ===' as status;
SELECT 'This allows all operations. If project creation works now, RLS was the issue.' as note;

-- Step 4: (After testing) Re-enable with proper policies
-- Uncomment below after you've tested project creation:
--
-- ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
--
-- -- SELECT: Users can see members of projects they're in
-- CREATE POLICY "Users can view project members"
--   ON project_members FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM project_members pm2
--       WHERE pm2.project_id = project_members.project_id
--       AND pm2.user_id = auth.uid()
--     )
--   );
--
-- -- INSERT: Project owners and admins can add members
-- CREATE POLICY "Project admins can add members"
--   ON project_members FOR INSERT
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM projects
--       WHERE id = project_members.project_id
--       AND (owner_id = auth.uid() OR
--            id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager')))
--     )
--   );
--
-- -- UPDATE: Project owners and admins can update members
-- CREATE POLICY "Project admins can update members"
--   ON project_members FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM projects
--       WHERE id = project_members.project_id
--       AND (owner_id = auth.uid() OR
--            id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager')))
--     )
--   );
--
-- -- DELETE: Project owners and admins can remove members
-- CREATE POLICY "Project admins can remove members"
--   ON project_members FOR DELETE
--   USING (
--     EXISTS (
--       SELECT 1 FROM projects
--       WHERE id = project_members.project_id
--       AND (owner_id = auth.uid() OR
--            id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager')))
--     )
--   );
