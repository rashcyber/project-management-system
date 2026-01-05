-- Project files table
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Project files policies
DROP POLICY IF EXISTS "Project members can view project files" ON project_files;
CREATE POLICY "Project members can view project files" ON project_files
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = project_files.project_id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project members can upload project files" ON project_files;
CREATE POLICY "Project members can upload project files" ON project_files
FOR INSERT WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = project_files.project_id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own project files" ON project_files;
CREATE POLICY "Users can delete their own project files" ON project_files
FOR DELETE USING (uploaded_by = auth.uid());

-- Storage policies for 'project-files' bucket
-- NOTE: Bucket must be created first in Supabase UI
DO $$
BEGIN
  -- Create policies if bucket exists (Supabase Storage schema)
  -- Policy for allowing authenticated uploads
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-files') THEN
    CREATE POLICY "Allow authenticated upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'project-files');

    CREATE POLICY "Allow member view" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'project-files');

    CREATE POLICY "Allow member delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'project-files' AND (auth.uid()::text = (storage.foldername(name))[1]));
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
