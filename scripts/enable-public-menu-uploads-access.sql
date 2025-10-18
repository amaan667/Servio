-- Enable public access to menu_uploads for customer ordering UI
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on menu_uploads (if not already enabled)
ALTER TABLE menu_uploads ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any)
DROP POLICY IF EXISTS "Public can read menu uploads" ON menu_uploads;
DROP POLICY IF EXISTS "Anyone can read menu uploads" ON menu_uploads;

-- 3. Create public read policy for menu_uploads
-- This allows customers to view PDF images in the ordering UI
CREATE POLICY "Public can read menu uploads"
ON menu_uploads FOR SELECT
USING (true);

-- 4. Verify the policy was created
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

-- 5. Test query (should work without authentication)
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

