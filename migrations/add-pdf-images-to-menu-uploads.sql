-- Add PDF images column to menu_uploads table
-- This stores an array of image URLs for each page of the uploaded PDF

ALTER TABLE menu_uploads 
ADD COLUMN IF NOT EXISTS pdf_images TEXT[];

-- Add comment
COMMENT ON COLUMN menu_uploads.pdf_images IS 'Array of image URLs for each page of the uploaded PDF menu';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_menu_uploads_pdf_images ON menu_uploads(venue_id, created_at DESC) WHERE pdf_images IS NOT NULL;

