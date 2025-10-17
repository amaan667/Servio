-- Fix PDF Images Issue
-- This script ensures the pdf_images column exists and is properly configured

-- 1. Add pdf_images column if it doesn't exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS pdf_images TEXT[] DEFAULT '{}';

-- 2. Add category_order column if it doesn't exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}';

-- 3. Add storage_path column if it doesn't exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 4. Add file_size column if it doesn't exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 5. Add extracted_text_length column if it doesn't exist
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS extracted_text_length INTEGER;

-- 6. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_uploads_venue_created 
ON menu_uploads(venue_id, created_at DESC);

-- 7. Add comments to columns
COMMENT ON COLUMN menu_uploads.pdf_images IS 'Array of URLs to converted PDF page images for interactive preview';
COMMENT ON COLUMN menu_uploads.category_order IS 'Array of category names in display order';
COMMENT ON COLUMN menu_uploads.storage_path IS 'Path to the original PDF file in storage';
COMMENT ON COLUMN menu_uploads.file_size IS 'Size of the uploaded file in bytes';

-- 8. Verify the columns exist
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'menu_uploads'
AND column_name IN ('pdf_images', 'category_order', 'storage_path', 'file_size', 'extracted_text_length')
ORDER BY column_name;

-- 9. Check if there are any menu uploads with pdf_images
SELECT 
  venue_id,
  filename,
  array_length(pdf_images, 1) as image_count,
  created_at
FROM menu_uploads
WHERE pdf_images IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

