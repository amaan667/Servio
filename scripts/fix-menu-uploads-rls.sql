-- Fix menu_uploads RLS and columns for customer ordering UI
-- Run this in Supabase SQL Editor

-- Step 1: Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_uploads' 
ORDER BY ordinal_position;

-- Step 2: Add missing columns if they don't exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS pdf_images TEXT[] DEFAULT '{}';

ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS pdf_images_cc TEXT[] DEFAULT '{}';

ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}';

ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS file_size BIGINT;

ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS extracted_text_length INTEGER;

-- Step 3: Disable RLS temporarily to check data
ALTER TABLE menu_uploads DISABLE ROW LEVEL SECURITY;

-- Step 4: Check if there's any data
SELECT 
  id,
  venue_id,
  filename,
  storage_path,
  array_length(pdf_images, 1) as pdf_images_count,
  array_length(pdf_images_cc, 1) as pdf_images_cc_count,
  created_at
FROM menu_uploads
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Re-enable RLS with public read access
ALTER TABLE menu_uploads ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop ALL existing policies
DROP POLICY IF EXISTS "Public can read menu uploads" ON menu_uploads;
DROP POLICY IF EXISTS "Anyone can read menu uploads" ON menu_uploads;
DROP POLICY IF EXISTS "Users can view their venue's menu uploads" ON menu_uploads;
DROP POLICY IF EXISTS "Users can manage their venue's menu uploads" ON menu_uploads;

-- Step 7: Create ONLY public read policy (no authentication required)
CREATE POLICY "Public can read menu uploads"
ON menu_uploads FOR SELECT
TO public
USING (true);

-- Step 8: Verify the policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'menu_uploads';

-- Step 9: Test the query (should work now)
SELECT 
  id,
  venue_id,
  filename,
  storage_path,
  array_length(pdf_images, 1) as pdf_images_count,
  array_length(pdf_images_cc, 1) as pdf_images_cc_count,
  created_at
FROM menu_uploads
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC
LIMIT 1;

