-- Create venue-assets storage bucket for logos and other venue assets
-- Run this in your Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'venue-assets',
  'venue-assets',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

-- Set up RLS policies for the bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload venue assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view venue assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update venue assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete venue assets" ON storage.objects;

-- Create new policies
CREATE POLICY "Authenticated users can upload venue assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'venue-assets');

CREATE POLICY "Public can view venue assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'venue-assets');

CREATE POLICY "Authenticated users can update venue assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'venue-assets')
WITH CHECK (bucket_id = 'venue-assets');

CREATE POLICY "Authenticated users can delete venue assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'venue-assets');

