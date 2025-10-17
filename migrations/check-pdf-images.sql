-- Check if pdf_images column exists and has data
-- Run this in your Supabase SQL Editor

-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_uploads' 
  AND column_name = 'pdf_images';

-- Check recent uploads and their pdf_images
SELECT 
  id,
  venue_id,
  filename,
  created_at,
  pdf_images,
  array_length(pdf_images, 1) as image_count
FROM menu_uploads
ORDER BY created_at DESC
LIMIT 5;

