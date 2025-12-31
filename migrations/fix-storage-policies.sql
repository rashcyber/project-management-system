-- Fix storage bucket policies for task-files
-- Run this in Supabase SQL Editor

-- Allow public upload to task-files bucket
CREATE POLICY "Allow public upload" ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'task-files'
);

-- Allow public view on task-files bucket
CREATE POLICY "Allow public view" ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'task-files'
);

-- Allow public delete on task-files bucket
CREATE POLICY "Allow public delete" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-files'
);
