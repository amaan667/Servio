-- Fix PDF Storage and Images Issue
-- Run this in Supabase SQL Editor

-- 1. Ensure pdf_images column exists
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS pdf_images TEXT[] DEFAULT '{}';

-- 2. Ensure other required columns exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}';
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS extracted_text_length INTEGER;

-- 3. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_menu_uploads_venue_created 
ON menu_uploads(venue_id, created_at DESC);

-- 4. Make the menus storage bucket public (CRITICAL!)
-- This allows the PDF images to be accessed via public URLs
UPDATE storage.buckets
SET public = true
WHERE name = 'menus';

-- 5. If the bucket doesn't exist, create it as public
INSERT INTO storage.buckets (id, name, public)
VALUES ('menus', 'menus', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6. Set storage policies to allow public access
-- Drop existing policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read" ON storage.objects;

-- Create policy for public read access
CREATE POLICY "Public Read"
ON storage.objects FOR SELECT
USING (bucket_id = 'menus');

-- 7. Verify the bucket is public
SELECT name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'menus';

-- 8. Check existing menu uploads
SELECT 
  id,
  venue_id,
  filename,
  storage_path,
  array_length(pdf_images, 1) as pdf_images_count,
  created_at
FROM menu_uploads
ORDER BY created_at DESC
LIMIT 5;

