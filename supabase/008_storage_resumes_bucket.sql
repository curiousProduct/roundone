-- Migration 008: Create resumes storage bucket and access policies
--
-- Run this in the Supabase SQL Editor if the bucket does not already exist.
-- The Express backend auto-creates the bucket on first upload (service role),
-- but the policies below are needed for public read access.

-- Create bucket (idempotent via DO block)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('resumes', 'resumes', true, 5242880)
  ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = 5242880;
END $$;

-- Allow authenticated users to upload resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Allow authenticated uploads to resumes'
  ) THEN
    CREATE POLICY "Allow authenticated uploads to resumes"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'resumes');
  END IF;
END $$;

-- Allow public read of resume files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Allow public read of resumes'
  ) THEN
    CREATE POLICY "Allow public read of resumes"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'resumes');
  END IF;
END $$;

-- Allow authenticated users to delete their own uploads (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Allow authenticated delete from resumes'
  ) THEN
    CREATE POLICY "Allow authenticated delete from resumes"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'resumes');
  END IF;
END $$;
