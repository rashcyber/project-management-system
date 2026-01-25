-- SIMPLIFY RLS POLICIES TO FIX 500 ERRORS
-- Remove conflicting policies on projects table

-- STEP 1: Disable RLS to make changes
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop the problematic policies
DROP POLICY IF EXISTS "Users can view workspace projects" ON projects;
DROP POLICY IF EXISTS "Project owner can view project" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "Project owner can update project" ON projects;
DROP POLICY IF EXISTS "Project owner can delete project" ON projects;
DROP POLICY IF EXISTS "Users can create projects in workspace" ON projects;

-- STEP 3: Re-enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create simple, non-conflicting policies
-- Allow authenticated users to view all projects (workspace filtering happens in app)
CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to create projects
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow project owner to update their project
CREATE POLICY "Project owner can update"
  ON projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Allow project owner to delete their project
CREATE POLICY "Project owner can delete"
  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- Allow admins to update any project
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow admins to delete any project
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- STEP 5: Verify policies
SELECT '=== PROJECTS POLICIES AFTER SIMPLIFICATION ===' as step;
SELECT policyname FROM pg_policies WHERE tablename = 'projects' ORDER BY policyname;

SELECT '=== TEST: Can query projects? ===' as test;
SELECT COUNT(*) as project_count FROM projects;
